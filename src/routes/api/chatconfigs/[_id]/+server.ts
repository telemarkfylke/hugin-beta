import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

const chatConfigStore = getChatConfigStore()

const replaceChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const chatConfigId = requestEvent.params._id
	if (!chatConfigId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const body = await requestEvent.request.json()

	const chatConfig = parseChatConfig(body, APP_CONFIG)

	const newChatConfig = await chatConfigStore.replaceChatConfig(chatConfigId, chatConfig)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceChatConfig)
}
