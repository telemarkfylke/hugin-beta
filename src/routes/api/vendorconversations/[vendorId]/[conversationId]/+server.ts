import type { RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canDeleteVendorConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { VendorId } from "$lib/types/vendor-ids"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const deleteVendorConversation: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	const { vendorId, conversationId } = requestEvent.params
	if (!vendorId) {
		throw new HTTPError(400, "vendorId is required")
	}
	if (!conversationId) {
		throw new HTTPError(400, "conversationId is required")
	}
	if (!canDeleteVendorConversation(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to delete vendorconversations`)
	}
	const vendor = createVendor(vendorId as VendorId)
	await vendor.deleteConversation(conversationId)

	return {
		response: new Response(null, { status: 204 }),
		isAuthorized: true
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, deleteVendorConversation)
}
