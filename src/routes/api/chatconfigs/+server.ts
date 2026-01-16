import { json, type RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getChatConfigStore } from "$lib/server/db/get-db"
import type { ChatConfig } from "$lib/types/chat"

const chatConfigStore = getChatConfigStore()

const createChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	// Husk validering her

	const chatConfig = body as ChatConfig
	const newChatConfig = await chatConfigStore.createChatConfig(chatConfig)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createChatConfig)
}
