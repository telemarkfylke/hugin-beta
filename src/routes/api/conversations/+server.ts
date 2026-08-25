import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseHistory } from "$lib/authorization"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatHistory, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

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
const splitIntoPairs = (history: ChatHistory): { userInput: ChatInputItem; response: ChatResponseObject }[] => {
	const pairs: { userInput: ChatInputItem; response: ChatResponseObject }[] = []
	for (let i = 0; i + 1 < history.length; i += 2) {
		const userInput = history[i]
		const response = history[i + 1]
		if (userInput?.type !== "message.input" || response?.type !== "chat_response") {
			throw new HTTPError(400, "history must alternate message.input and chat_response items")
		}
		if (response.status === "failed") {
			continue // Same reasoning as chatHistoryToInputItems - a failed turn isn't real assistant context.
		}
		pairs.push({ userInput, response })
	}
	return pairs
}

const createConversationFromHistory: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	// Students' conversations must never be persisted - same rule as the normal chat save path.
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
