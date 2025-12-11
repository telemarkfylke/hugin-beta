import type { RequestHandler } from "@sveltejs/kit"
import { deleteDBConversation, getDBConversation } from "$lib/server/agents/conversations"
import { createVendor } from "$lib/server/agents/vendors"
import { canDeleteConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const deleteConversation: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	const { conversationId } = requestEvent.params
	if (!conversationId) {
		throw new HTTPError(400, "conversationId is required")
	}
	const dbConversation = await getDBConversation(conversationId)

	if (!canDeleteConversation(user, dbConversation)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to delete conversations`)
	}

	// First delete from the vendor
	const vendor = createVendor(dbConversation.vendorId)
	await vendor.deleteConversation(dbConversation.vendorConversationId) // Hm, might need to make this return good if the conversation doesn't exist

	// Then delete from our DB
	await deleteDBConversation(conversationId)

	return {
		response: new Response(null, { status: 204 }),
		isAuthorized: true
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, deleteConversation)
}
