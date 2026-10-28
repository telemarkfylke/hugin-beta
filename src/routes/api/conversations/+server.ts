import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseHistory } from "$lib/authorization"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatHistory, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatOutputItem } from "$lib/types/chat-item"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { ChatInputItemSchema } from "$lib/validation/chat-input-schema"

const getConversations: ApiNextFunction = async ({ user }) => {
	const conversations = await getConversationManager().listConversations(user)
	return {
		isAuthorized: true,
		response: json(conversations)
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getConversations)
}

// A ChatHistory is always pushed as alternating (userInput, response) pairs - one per turn, see
// ChatState.svelte.ts:promptChat - so splitting it back into pairs is just walking it two at a time.
// Used to bulk-persist a history that was assembled outside the normal per-turn save path: an
// imported .kráa file, or a conversation that was incognito from its very first message and so
// never got a conversationId.
// The stored turns are replayed to the model on every later message, so they get the same checks as
// /api/chat inputs (chat-input-schema.ts): only user/assistant roles - an imported "system" turn would
// otherwise override the assistant's instructions for the rest of the conversation - and bounded sizes.
const MAX_IMPORTED_PAIRS = 200

const splitIntoPairs = (history: ChatHistory): { userInput: ChatInputItem; response: ChatResponseObject }[] => {
	if (history.length > MAX_IMPORTED_PAIRS * 2) {
		throw new HTTPError(400, `history can have at most ${MAX_IMPORTED_PAIRS} turns`)
	}
	const pairs: { userInput: ChatInputItem; response: ChatResponseObject }[] = []
	for (let i = 0; i + 1 < history.length; i += 2) {
		const userInput = ChatInputItemSchema.safeParse(history[i])
		const response = history[i + 1]
		if (!userInput.success || userInput.data.type !== "message.input" || response?.type !== "chat_response" || !Array.isArray(response.outputs)) {
			throw new HTTPError(400, "history must alternate valid message.input and chat_response items")
		}
		if (response.status === "failed") {
			continue // Same reasoning as chatHistoryToInputItems - a failed turn isn't real assistant context.
		}
		const outputs = response.outputs.map((output) => ChatInputItemSchema.safeParse(output))
		if (outputs.some((output) => !output.success || output.data.type !== "message.output")) {
			throw new HTTPError(400, "chat_response outputs must be assistant messages")
		}
		pairs.push({ userInput: userInput.data as ChatInputItem, response: { ...response, outputs: outputs.map((output) => output.data) as ChatOutputItem[] } })
	}
	return pairs
}

const createConversationFromHistory: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	// Users without history must never have conversations persisted - same rule as the normal chat save path.
	if (!canUseHistory(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to store conversation history")
	}

	const body = (await requestEvent.request.json()) as { history?: ChatHistory }
	if (!Array.isArray(body.history) || body.history.length === 0) {
		throw new HTTPError(400, "history must be a non-empty array")
	}

	const pairs = splitIntoPairs(body.history)
	if (pairs.length === 0) {
		throw new HTTPError(400, "history did not contain any complete message pairs to save")
	}

	const conversation = await getConversationManager().createConversationWithHistory(pairs, user)
	return {
		isAuthorized: true,
		response: json(conversation)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createConversationFromHistory)
}
