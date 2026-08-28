import { json, type RequestHandler } from "@sveltejs/kit"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const getConversation: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const conversationId = requestEvent.params._id
	if (!conversationId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const conversationManager = getConversationManager()
	const conversation = await conversationManager.getConversation(conversationId, user)
	if (!conversation) {
		throw new HTTPError(404, "Conversation not found")
	}

	const history = await conversationManager.getChatHistoryFromDb(conversationId, user)

	return {
		isAuthorized: true,
		response: json({ conversation, history })
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getConversation)
}

const MAX_TITLE_LENGTH = 200

const renameConversation: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const conversationId = requestEvent.params._id
	if (!conversationId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const body = await requestEvent.request.json().catch(() => null)
	const title = body && typeof body === "object" && "title" in body ? body.title : undefined
	if (typeof title !== "string" || !title.trim()) {
		throw new HTTPError(400, "title must be a non-empty string")
	}
	if (title.length > MAX_TITLE_LENGTH) {
		throw new HTTPError(400, `title must be at most ${MAX_TITLE_LENGTH} characters`)
	}

	const conversationManager = getConversationManager()
	const conversation = await conversationManager.getConversation(conversationId, user)
	if (!conversation) {
		throw new HTTPError(404, "Conversation not found")
	}

	const updatedTitle = await conversationManager.renameConversation(conversationId, title, user)

	return {
		isAuthorized: true,
		response: json({ title: updatedTitle })
	}
}

export const PATCH: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, renameConversation)
}

const deleteConversation: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const conversationId = requestEvent.params._id
	if (!conversationId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const conversationManager = getConversationManager()
	const conversation = await conversationManager.getConversation(conversationId, user)
	if (!conversation) {
		throw new HTTPError(404, "Conversation not found")
	}

	await conversationManager.deleteConversation(conversationId, user)

	return {
		isAuthorized: true,
		response: json({ message: "Conversation deleted" })
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteConversation)
}
