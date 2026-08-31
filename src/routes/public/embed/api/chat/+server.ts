import { json, type RequestHandler } from "@sveltejs/kit"
import z from "zod"
import { ANONYMOUS_PRINCIPAL } from "$lib/anonymous-principal"
import { getVendor } from "$lib/server/ai-vendors"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { formatRagContextText } from "$lib/server/ragservice/format-rag-context"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { responseStream } from "$lib/streaming"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"

const chatConfigStore = getChatConfigStore()

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

	// --- From here down: the same RAG-search + vendor-dispatch logic as supahChat
	// (src/routes/api/chat/+server.ts) - deliberately duplicated rather than shared for now, to
	// avoid touching that well-exercised, authenticated code path in a PoC. NO persistence code
	// (conversationManager / appendConversationMessage / captureAndPersistStream) is included -
	// anonymous conversations are never stored.
	//
	// No dbConfig.tools gate here (unlike supahChat) - "tools" is never persisted on ChatConfig,
	// it's purely a per-message frontend choice in the authenticated flow. The public embed doesn't
	// offer that choice at all: any configured RAG datasource is always searched.
	const ragStoreIds = dbConfig.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []

	if (ragStoreIds.length > 0) {
		const lastUserMsg = [...inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")

		const queryText =
			lastUserMsg?.content
				.filter((c): c is InputText => c.type === "input_text")
				.map((c) => c.text)
				.join(" ")
				.trim() ?? ""

		if (queryText) {
			// Anonymous caller: no graph token. getUserGroups falls back to [] when both the
			// principal's groups and the token are empty, so this still works, just with no groups.
			const matches = await searchRagStores(ragStoreIds, queryText, ANONYMOUS_PRINCIPAL, null)

			if (matches.length > 0) {
				const contextText = formatRagContextText(matches)
				dbConfig.instructions = `${dbConfig.instructions ?? ""}\n\n#Relevant kontekst fra datakilder:\n\n${contextText}`
			}
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	dbConfig.tools = dbConfig.tools?.filter((t) => t.type !== "datasource")

	const vendor = getVendor(dbConfig.vendorId)
	const chatRequest = { config: dbConfig, inputs, stream: Boolean(parsed.data.stream) }

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)
		return responseStream(stream)
	}

	const response = await vendor.createChatResponse(chatRequest)
	return json(response)
}
