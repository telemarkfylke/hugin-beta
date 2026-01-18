import { json, type RequestHandler } from "@sveltejs/kit"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"
import { APP_CONFIG } from "$lib/server/app-config/app-config"

const chatConfigStore = getChatConfigStore()

const createChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatConfig = parseChatConfig(body, APP_CONFIG)

	const newChatConfig = await chatConfigStore.createChatConfig(chatConfig)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createChatConfig)
}
