import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Fire-and-forget from the client (on "new chat" / opening a titleless conversation) - idempotent,
// generateTitle no-ops if the conversation already has a title or doesn't exist/isn't owned by the user.
const generateConversationTitle: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const conversationId = requestEvent.params._id
	if (!conversationId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	try {
		await getConversationManager().generateTitle(conversationId, user)
	} catch (error) {
		logger.errorException(error, "Failed to generate conversation title")
	}

	return {
		isAuthorized: true,
		response: json({ message: "Title generation requested" })
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, generateConversationTitle)
}
