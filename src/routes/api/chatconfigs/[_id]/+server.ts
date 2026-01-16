import { json, type RequestHandler } from "@sveltejs/kit"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()

const updateChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
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

	// Husk validering her

	const chatConfig = body as Partial<ChatConfig>
	const newChatConfig = await chatConfigStore.updateChatConfig(chatConfigId, chatConfig)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

export const PATCH: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, updateChatConfig)
}
