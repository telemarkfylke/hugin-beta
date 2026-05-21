import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { deleteChatConfig, replaceChatConfig } from "$lib/server/services/chat-config-service"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()

const replaceChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const configId = requestEvent.params._id
	if (!configId) {
		throw new HTTPError(400, "_id parameter is required")
	}
	const body = await requestEvent.request.json()
	const updated = await replaceChatConfig(configId, body, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json(updated) }
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceChatConfigHandler)
}

const deleteChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const configId = requestEvent.params._id
	if (!configId) {
		throw new HTTPError(400, "_id parameter is required")
	}
	await deleteChatConfig(configId, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json({ message: "Chat config deleted" }) }
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteChatConfigHandler)
}
