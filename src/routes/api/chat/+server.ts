import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canPromptConfig, canUseHistory, canUseMcpSharepoint, canUseWebsiteDataSource } from "$lib/authorization"
import { chatHistoryToInputItems } from "$lib/chat-history"
import { applyChatSseEventToResponseObject } from "$lib/chat-response-builder"
import type { ConversationManager } from "$lib/conversationstore/server/conv_manager"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { recordQuestionCategoryStat } from "$lib/server/categorize-question"
import { getMcpSourceStore, getWebsiteSourceStore } from "$lib/server/db/get-db"
import { appendAgenticToolGuidance } from "$lib/server/mcp/agentic-tool-guidance"
import { buildMcpToolClients } from "$lib/server/mcp/build-mcp-tool-clients"
import { createCombinedToolClient } from "$lib/server/mcp/combined-tool-client"
import type { McpClient } from "$lib/server/mcp/mcp-client"
import { runAgenticToolChatOrDegrade } from "$lib/server/mcp/run-agentic-chat"
import { configHasMcpTool, mcpUnavailableStream } from "$lib/server/mcp/run-mcp-chat"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { appendRagContextToInstructions } from "$lib/server/ragservice/format-rag-context"
import { rewriteRagQuery } from "$lib/server/ragservice/rag-query-rewrite"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { createWebsiteToolClient } from "$lib/server/website-tools/website-tool-client"
import { createSse, parseSse, responseStream } from "$lib/streaming"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"
import type { McpSource } from "$lib/types/mcp-source"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import type { WebsiteSourceEntry } from "$lib/types/website-source"
import { validateFileInputs } from "$lib/validation/file-input"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

const parseChatRequest = (body: unknown): ChatRequest => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const incomingChatRequest: ChatRequest = body as ChatRequest

	const config = parseChatConfig(incomingChatRequest.config, APP_CONFIG)

	if (!Array.isArray(incomingChatRequest.inputs) || incomingChatRequest.inputs.length === 0) {
		throw new HTTPError(400, "inputs must be a non-empty array")
	}
	if (config.vendorAgent) {
		return {
			config,
			inputs: incomingChatRequest.inputs,
			stream: Boolean(incomingChatRequest.stream),
			store: Boolean(incomingChatRequest.store),
			huginConversationId: incomingChatRequest.huginConversationId
		}
	}

	const manualChatRequest: ChatRequest = {
		config,
		inputs: incomingChatRequest.inputs,
		stream: Boolean(incomingChatRequest.stream),
		store: Boolean(incomingChatRequest.store),
		huginConversationId: incomingChatRequest.huginConversationId
	}

	validateFileInputs(manualChatRequest, APP_CONFIG)

	return manualChatRequest
}

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatRequest = parseChatRequest(body)

	// Students' conversations must never be persisted - enforce server-side regardless of
	// what the client sent, since the incognito toggle is only hidden/disabled client-side.
	if (!canUseHistory(user, APP_CONFIG.APP_ROLES)) {
		chatRequest.store = false
	}

	if (!canPromptConfig(user, APP_CONFIG, chatRequest.config)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	const userInputMessage = [...chatRequest.inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")

	const queryText =
		userInputMessage?.content
			.filter((c): c is InputText => c.type === "input_text")
			.map((c) => c.text)
			.join(" ")
			.trim() ?? ""

	// Write-time, anonymous question-category statistics (see $lib/statsstore/types) - deliberately
	// independent of chatRequest.store/incognito below, since that's often forced off (canUseHistory
	// above) and is the whole reason this can't just be derived from stored conversation history
	// afterwards. Fire-and-forget: must never block or slow down the actual chat response, and a
	// failure here is only logged, never surfaced to the user.
	if (chatRequest.config.categories?.length && queryText) {
		recordQuestionCategoryStat(chatRequest.config._id, queryText, chatRequest.config.categories).catch((error) => {
			logger.errorException(error, "Failed to record question category stat")
		})
	}

	// Resolve/prepend history before the RAG step below, so query rewriting has the full
	// conversation to resolve pronouns/references against - not just the newest message.
	let huginConversationId: string | undefined
	if (chatRequest.store && userInputMessage) {
		const conversationManager = getConversationManager()
		huginConversationId = await conversationManager.getOrCreateConversationId(chatRequest.huginConversationId ?? null, user)

		const priorHistory = await conversationManager.getChatHistoryFromDb(huginConversationId, user)
		chatRequest.inputs = [...chatHistoryToInputItems(priorHistory), ...chatRequest.inputs]
	}

	const datasourceToolActive = chatRequest.config.tools?.some((t) => t.type === "datasource") ?? false
	const ragStoreIds = datasourceToolActive ? (chatRequest.config.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []) : []
	const websiteSourceIds = datasourceToolActive ? (chatRequest.config.dataSources?.filter((s) => s.type === "website").map((s) => s.id) ?? []) : []
	// Read before stripping tools below - RAG search (if active) still runs first and mutates
	// chatRequest.config.instructions either way, so the MCP/website loop (if also active) sees the
	// RAG-augmented instructions.
	const mcpSharepointActive = configHasMcpTool(chatRequest.config)

	if (mcpSharepointActive && !canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use SharePoint MCP")
	}

	if (websiteSourceIds.length > 0 && !canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use website data sources")
	}

	// Flatten every selected website source's entries into one combined allow-list - a bot can
	// have several website sources active at once, so the browse_website tool built from this
	// covers all of them together.
	let websiteEntries: WebsiteSourceEntry[] = []
	if (websiteSourceIds.length > 0) {
		const websiteSourceStore = getWebsiteSourceStore()
		const sources = await Promise.all(websiteSourceIds.map((id) => websiteSourceStore.getWebsiteSource(id)))
		websiteEntries = sources.flatMap((source) => source?.entries ?? [])
	}
	const websiteToolActive = websiteEntries.length > 0

	// mcpSharepointActive is its own ChatTool flag (independent of datasourceToolActive, unlike
	// ragservice/website) - resolve which McpSource(s) were actually selected only when it's on.
	const mcpSourceIds = mcpSharepointActive ? (chatRequest.config.dataSources?.filter((s) => s.type === "mcp").map((s) => s.sourceId) ?? []) : []
	let mcpSources: McpSource[] = []
	if (mcpSourceIds.length > 0) {
		const mcpSourceStore = getMcpSourceStore()
		const resolved = await Promise.all(mcpSourceIds.map((id) => mcpSourceStore.getMcpSource(id)))
		mcpSources = resolved.filter((source): source is McpSource => source !== null)
	}

	if (ragStoreIds.length > 0) {
		if (queryText) {
			const graphToken = requestEvent.request.headers.get(MS_AUTH_TOKEN_HEADER)
			const rewrittenQuery = await rewriteRagQuery({ chatRequest, queryText, ragStoreIds, user, graphToken })

			// Degrade gracefully if ragservice is unreachable or auth/token resolution fails - same
			// outcome as a non-2xx response from ragservice (searchRagStores returns [] for that case
			// already): answer without RAG context rather than failing the whole chat request.
			let matches: Awaited<ReturnType<typeof searchRagStores>> = []
			try {
				matches = await searchRagStores(ragStoreIds, rewrittenQuery, user, graphToken)
			} catch (error) {
				logger.errorException(error, "searchRagStores failed - continuing without RAG context")
			}

			if (matches.length > 0) {
				chatRequest.config.instructions = appendRagContextToInstructions(chatRequest.config.instructions, matches)
			}
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	chatRequest.config.tools = chatRequest.config.tools?.filter((t) => t.type !== "datasource" && t.type !== "mcp")

	const vendor = getVendor(chatRequest.config.vendorId)

	if (chatRequest.stream) {
		const stream = await buildToolCallingStream(chatRequest, vendor, mcpSources, websiteToolActive ? websiteEntries : [])

		if (huginConversationId && userInputMessage) {
			const [clientBranch, captureBranch] = stream.tee()

			const announceChunk = createSse({ event: "hugin_conversation.created", data: { huginConversationId } })
			const finalStream = prependChunk(clientBranch, announceChunk)

			captureAndPersistStream(captureBranch, getConversationManager(), huginConversationId, userInputMessage, chatRequest.config, user).catch((error) => {
				logger.errorException(error, "Failed to capture/persist streamed chat response")
			})

			return {
				isAuthorized: true,
				response: responseStream(finalStream)
			}
		}

		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(chatRequest)

	if (huginConversationId && userInputMessage) {
		try {
			await getConversationManager().appendConversationMessage(huginConversationId, userInputMessage, response, user)
		} catch (error) {
			logger.errorException(error, "Failed to persist chat response")
		}
		return {
			isAuthorized: true,
			response: json({ ...response, huginConversationId })
		}
	}

	return {
		isAuthorized: true,
		response: json(response)
	}
}

// Builds one combined tool-calling stream out of every active tool-calling data source (MCP,
// website, or both at once - see combined-tool-client.ts), or falls back to a plain vendor stream
// when neither is active. Replaces the earlier "MCP wins if both are active" v1 limitation - a
// bot can now genuinely use SharePoint and website browsing tools in the same conversation.
const buildToolCallingStream = async (chatRequest: ChatRequest, vendor: IAIVendor, mcpSources: McpSource[], websiteEntries: WebsiteSourceEntry[]): Promise<ReadableStream<Uint8Array>> => {
	const toolClients: McpClient[] = []
	let mcpUnavailable = false

	if (mcpSources.length > 0) {
		const { clients, unavailable } = await buildMcpToolClients(mcpSources)
		toolClients.push(...clients)
		if (unavailable) mcpUnavailable = true
	}
	if (websiteEntries.length > 0) {
		toolClients.push(createWebsiteToolClient(websiteEntries))
	}

	// The bot explicitly selected a SharePoint source but the real server is unreachable/
	// unconfigured - same strict behaviour as before this refactor: show the unavailable message
	// rather than silently answering without the SharePoint tools the bot was set up to have.
	if (mcpUnavailable) {
		return mcpUnavailableStream()
	}
	if (toolClients.length === 0) {
		return vendor.createChatResponseStream(chatRequest)
	}
	// Nudges the model to actually use the tools proactively - see agentic-tool-guidance.ts for why
	// this is needed at all (unlike RAG, nothing here runs the lookup for the model automatically).
	chatRequest.config.instructions = appendAgenticToolGuidance(chatRequest.config.instructions)
	return runAgenticToolChatOrDegrade(chatRequest, createCombinedToolClient(toolClients))
}

// Prepends one already-encoded SSE chunk to a stream, without buffering the rest of it.
const prependChunk = (stream: ReadableStream<Uint8Array>, chunk: Uint8Array): ReadableStream<Uint8Array> => {
	const reader = stream.getReader()
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(chunk)
		},
		async pull(controller) {
			const { value, done } = await reader.read()
			if (done) {
				controller.close()
				return
			}
			controller.enqueue(value)
		},
		cancel(reason) {
			return reader.cancel(reason)
		}
	})
}

// Reads the teed capture branch of a streamed vendor response, reconstructs the full
// ChatResponseObject from the same SSE events the client sees, then persists it once done.
const captureAndPersistStream = async (
	captureStream: ReadableStream<Uint8Array>,
	conversationManager: ConversationManager,
	huginConversationId: string,
	userInputMessage: ChatInputMessage,
	config: ChatConfig,
	user: AuthenticatedPrincipal
): Promise<void> => {
	const reader = captureStream.getReader()
	const decoder = new TextDecoder("utf-8")
	const chatResponseObject: ChatResponseObject = {
		id: "",
		type: "chat_response",
		config,
		createdAt: new Date().toISOString(),
		outputs: [],
		status: "in_progress",
		usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
	}
	while (true) {
		const { value, done } = await reader.read()
		const text = decoder.decode(value, { stream: true })
		for (const event of parseSse(text)) {
			if (event.event === "response.tool_call") {
				// Shared agentic-loop event, emitted by both the MCP and website tool-calling paths.
				logger.info("[chat] Agentic tool call: {toolName}", event.data.toolName)
			} else if (event.event === "response.tool_result") {
				logger.info("[chat] Agentic tool result: {toolName} ({status})", event.data.toolName, event.data.status)
			}
			applyChatSseEventToResponseObject(chatResponseObject, event)
		}
		if (done) break
	}
	await conversationManager.appendConversationMessage(huginConversationId, userInputMessage, chatResponseObject, user)
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
