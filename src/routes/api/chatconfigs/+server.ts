import { json, type RequestHandler } from "@sveltejs/kit"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"
import type { ChatConfig } from "$lib/types/chat"

const chatConfigStore = getChatConfigStore()

const getChatConfigs: ApiNextFunction = async ({ user }) => {
	const chatConfigs = await chatConfigStore.getChatConfigs(user)
	return {
		isAuthorized: true,
		response: json(chatConfigs)
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getChatConfigs)
}

const createChatConfig: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatConfig = parseChatConfig(body, APP_CONFIG)

	const chatConfigToCreate: ChatConfig = {
		...chatConfig,
		name: chatConfig.name || "Ny agent",
		_id: "",
		type: "private",
		accessGroups: [],
		created: {
			at: new Date().toISOString(),
			by: {
				id: user.userId,
				name: user.name
			}
		},
		updated: {
			at: new Date().toISOString(),
			by: {
				id: user.userId,
				name: user.name
			}
		}
	}

	const newChatConfig = await chatConfigStore.createChatConfig(chatConfigToCreate)

	return {
		isAuthorized: true,
		response: json(newChatConfig)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createChatConfig)
}
