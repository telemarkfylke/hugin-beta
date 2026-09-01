import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import z from "zod"
import { ANONYMOUS_PRINCIPAL } from "$lib/anonymous-principal"
import { getVendor } from "$lib/server/ai-vendors"
import { classifyQuestion, recordQuestionCategoryStat } from "$lib/server/categorize-question"
import { getChatConfigStore, getStatsStore } from "$lib/server/db/get-db"
import { appendRagContextToInstructions } from "$lib/server/ragservice/format-rag-context"
import { formatHistoryForRewrite } from "$lib/server/ragservice/rag-query-rewrite"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { createSse, responseStream } from "$lib/streaming"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"

const chatConfigStore = getChatConfigStore()

// Shown instead of a real answer when classifyQuestion judges the question out of scope for this
// bot (see the scope-guard block in POST below). Kept generic/neutral rather than referencing the
// bot by name - a canned refusal doesn't need to pretend to be a considered response.
const OUT_OF_SCOPE_MESSAGE = "Beklager, det spørsmålet er utenfor det jeg er satt opp til å hjelpe med her. Prøv gjerne å stille et spørsmål relatert til det jeg er ment å svare på."

// Synthesizes a minimal, valid ChatResponseObject for the canned refusal - same shape a real vendor
// response would have (see e.g. openai-mapping.ts), just built by hand since no vendor call is made.
const buildRefusalResponse = (config: ChatConfig, text: string): ChatResponseObject => ({
	id: crypto.randomUUID(),
	type: "chat_response",
	config,
	createdAt: new Date().toISOString(),
	outputs: [{ id: crypto.randomUUID(), type: "message.output", role: "assistant", content: [{ type: "output_text", text }] }],
	status: "completed",
	usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
})

// Streaming counterpart of buildRefusalResponse - the minimal SSE event sequence a real vendor
// stream produces (see e.g. litellm-stream.ts): started -> one full-text delta -> done.
const buildRefusalStream = (text: string): ReadableStream<Uint8Array> =>
	new ReadableStream({
		start(controller) {
			const itemId = crypto.randomUUID()
			controller.enqueue(createSse({ event: "response.started", data: { responseId: crypto.randomUUID() } }))
			controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId, content: text } }))
			controller.enqueue(createSse({ event: "response.done", data: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } } }))
			controller.close()
		}
	})

// ChatState/postChatMessage are reused unchanged from the authenticated flow (see EmbedChat.svelte),
// so the wire shape here is the same full ChatRequest they always send - config included. That's
// fine: config._id is used only as a lookup key below. Every value that actually reaches the vendor
// (instructions, tools, vendorId, ...) comes from the fresh DB-authoritative dbConfig, never from
// this parsed client object - the rest of the client's config is read nowhere and simply discarded.
const EmbedChatRequestSchema = z.object({
	config: z.object({ _id: z.string() }),
	inputs: z.array(z.any()).min(1),
	stream: z.boolean().optional()
})

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null)
	const parsed = EmbedChatRequestSchema.safeParse(body)
	if (!parsed.success) {
		return json({ message: "Invalid request" }, { status: 400 })
	}

	// Fresh DB lookup - never trust a config object from the client here. Same 404 whether the
	// id doesn't exist or just isn't anonymously embeddable (see the page load's same reasoning).
	const dbConfig = await chatConfigStore.getChatConfig(parsed.data.config._id)
	if (!dbConfig?.allowAnonymousEmbed) {
		return json({ message: "Not found" }, { status: 404 })
	}

	const inputs = parsed.data.inputs as ChatInputItem[]
	const wantsStream = Boolean(parsed.data.stream)

	// --- From here down: the same RAG-search + vendor-dispatch logic as supahChat
	// (src/routes/api/chat/+server.ts) - deliberately duplicated rather than shared for now, to
	// avoid touching that well-exercised, authenticated code path in a PoC. NO persistence code
	// (conversationManager / appendConversationMessage / captureAndPersistStream) is included -
	// anonymous conversations are never stored.
	//
	// No dbConfig.tools gate here (unlike supahChat) - "tools" is never persisted on ChatConfig,
	// it's purely a per-message frontend choice in the authenticated flow. The public embed doesn't
	// offer that choice at all: any configured RAG datasource is always searched.
	const lastUserMsg = [...inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")
	const queryText =
		lastUserMsg?.content
			.filter((c): c is InputText => c.type === "input_text")
			.map((c) => c.text)
			.join(" ")
			.trim() ?? ""

	// A/B flag (ChatConfig.scopeGuardEnabled, default off) - lets us compare guardrails-on vs
	// guardrails-off in practice before deciding this is how every embed bot should behave.
	if (queryText && dbConfig.scopeGuardEnabled) {
		// ON: scope-guard, combined with category classification in one utility-model call (see
		// classifyQuestion) - unlike supahChat's stats-only categorizeQuestion, this always runs
		// (even with no configured categories), because on this anonymous, public-facing route it's
		// also what keeps the bot from answering questions outside what it's meant for.
		//
		// History is passed so a bare follow-up ("Kan man ta med mat?" after "Når er eksamen?") is
		// judged in context instead of being misread as unrelated to the bot's purpose in isolation -
		// see classifyQuestion's own comment on why this matters more for inScope than for category.
		const categories = dbConfig.categories ?? []
		const history = formatHistoryForRewrite(inputs, lastUserMsg)
		const { category, suggestedTopic, inScope } = await classifyQuestion({ questionText: queryText, categories, scopeDescription: dbConfig.description, history })

		if (categories.length > 0) {
			// Fire-and-forget - must never block or fail the actual chat response.
			getStatsStore()
				.recordQuestionCategory(dbConfig._id, category, new Date(), suggestedTopic)
				.catch((error) => {
					logger.errorException(error, "Failed to record question category stat")
				})
		}

		if (!inScope) {
			return wantsStream ? responseStream(buildRefusalStream(OUT_OF_SCOPE_MESSAGE)) : json(buildRefusalResponse(dbConfig, OUT_OF_SCOPE_MESSAGE))
		}
	} else if (queryText && dbConfig.categories?.length) {
		// OFF (default): the exact same code path supahChat has always used - fire-and-forget,
		// stats-only, no scope check, nothing ever blocked. Keeping this a literal call to the same
		// shared function (not a lookalike) is the point of the A/B test: the "off" arm must be
		// genuinely identical to today's supahChat behavior, not just similar to it.
		recordQuestionCategoryStat(dbConfig._id, queryText, dbConfig.categories).catch((error) => {
			logger.errorException(error, "Failed to record question category stat")
		})
	}

	const ragStoreIds = dbConfig.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []

	if (ragStoreIds.length > 0 && queryText) {
		// Anonymous caller: no graph token. getUserGroups falls back to [] when both the
		// principal's groups and the token are empty, so this still works, just with no groups.
		const matches = await searchRagStores(ragStoreIds, queryText, ANONYMOUS_PRINCIPAL, null)

		if (matches.length > 0) {
			dbConfig.instructions = appendRagContextToInstructions(dbConfig.instructions, matches)
		} else if (dbConfig.emptyRagGuardEnabled) {
			// A/B flag (ChatConfig.emptyRagGuardEnabled, default off), independent of
			// scopeGuardEnabled above - a bot with sources configured but zero relevant chunks found
			// would otherwise have the vendor answer from its own general knowledge, ungrounded.
			// Reuses OUT_OF_SCOPE_MESSAGE rather than a separate wording - from the visitor's side
			// both boil down to "I can't help with that here".
			return wantsStream ? responseStream(buildRefusalStream(OUT_OF_SCOPE_MESSAGE)) : json(buildRefusalResponse(dbConfig, OUT_OF_SCOPE_MESSAGE))
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	dbConfig.tools = dbConfig.tools?.filter((t) => t.type !== "datasource")

	const vendor = getVendor(dbConfig.vendorId)
	const chatRequest = { config: dbConfig, inputs, stream: wantsStream }

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)
		return responseStream(stream)
	}

	const response = await vendor.createChatResponse(chatRequest)
	return json(response)
}
