import { json, type RequestHandler } from "@sveltejs/kit"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
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
