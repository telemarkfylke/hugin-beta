import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createChatConfig, listChatConfigs } from "$lib/server/services/chat-config-service"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()

const getChatConfigs: ApiNextFunction = async ({ user }) => {
	const chatConfigs = await listChatConfigs(user, chatConfigStore)
	return { isAuthorized: true, response: json(chatConfigs) }
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getChatConfigs)
}

const createChatConfigHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	const body = await requestEvent.request.json()
	const newConfig = await createChatConfig(body, user, APP_CONFIG, chatConfigStore)
	return { isAuthorized: true, response: json(newConfig) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createChatConfigHandler)
}
