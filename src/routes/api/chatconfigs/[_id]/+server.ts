import { json, type RequestHandler } from "@sveltejs/kit"
import { canUpdateChatConfig } from "$lib/authorization"
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

	const chatConfigToReplace = await chatConfigStore.getChatConfig(chatConfigId)

	if (!chatConfigToReplace) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, APP_CONFIG.APP_ROLES, chatConfigToReplace, chatConfig)) {
		throw new HTTPError(403, "Not authorized to update this chat config")
	}

	const newChatConfig = await chatConfigStore.replaceChatConfig(chatConfigId, chatConfig)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

const deleteChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
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

	const chatConfigToDelete = await chatConfigStore.getChatConfig(chatConfigId)

	if (!chatConfigToDelete) {
		throw new HTTPError(404, "Chat config not found")
	}

	if (!canUpdateChatConfig(user, APP_CONFIG.APP_ROLES, chatConfigToDelete, chatConfigToDelete)) {
		throw new HTTPError(403, "Not authorized to delete this chat config")
	}

	await chatConfigStore.deleteChatConfig(chatConfigId)

	return {
		isAuthorized: true,
		response: json({ message: "Chat config deleted" })
	}
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceChatConfig)
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteChatConfig)
}
