import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canPromptConfig } from "$lib/authorization"
import { chatHistoryToInputItems } from "$lib/chat-history"
import { applyChatSseEventToResponseObject } from "$lib/chat-response-builder"
import type { ConversationManager } from "$lib/conversationstore/server/conv_manager"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { createSse, parseSse, responseStream } from "$lib/streaming"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
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

	if (!canPromptConfig(user, APP_CONFIG, chatRequest.config)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	const datasourceToolActive = chatRequest.config.tools?.some((t) => t.type === "datasource") ?? false
	const ragStoreIds = datasourceToolActive ? (chatRequest.config.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []) : []

	if (ragStoreIds.length > 0) {
		const lastUserMsg = [...chatRequest.inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")

		const queryText =
			lastUserMsg?.content
				.filter((c): c is InputText => c.type === "input_text")
				.map((c) => c.text)
				.join(" ")
				.trim() ?? ""

		if (queryText) {
			const graphToken = requestEvent.request.headers.get(MS_AUTH_TOKEN_HEADER)
			const matches = await searchRagStores(ragStoreIds, queryText, user, graphToken)

			if (matches.length > 0) {
				const contextText = matches.map((m) => m.text).join("\n\n---\n\n")
				chatRequest.config.instructions = `${chatRequest.config.instructions ?? ""}\n\n#Relevant kontekst fra datakilder:\n\n${contextText}`
			}
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	chatRequest.config.tools = chatRequest.config.tools?.filter((t) => t.type !== "datasource")

	const vendor = getVendor(chatRequest.config.vendorId)

	const userInputMessage = [...chatRequest.inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")

	let huginConversationId: string | undefined
	if (chatRequest.store && userInputMessage) {
		const conversationManager = getConversationManager()
		huginConversationId = await conversationManager.getOrCreateConversationId(chatRequest.huginConversationId ?? null, user)

		const priorHistory = await conversationManager.getChatHistoryFromDb(huginConversationId, user)
		chatRequest.inputs = [...chatHistoryToInputItems(priorHistory), ...chatRequest.inputs]
	}

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)

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
			applyChatSseEventToResponseObject(chatResponseObject, event)
		}
		if (done) break
	}
	await conversationManager.appendConversationMessage(huginConversationId, userInputMessage, chatResponseObject, user)
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
