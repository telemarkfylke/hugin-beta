import { json, type RequestHandler } from "@sveltejs/kit"
import { canViewVendorConversations } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { MistralVendor } from "$lib/server/mistral/mistral"
import type { GetVendorConversationsResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const getVendorConversations: MiddlewareNextFunction = async ({ user }) => {
	if (!canViewVendorConversations(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor conversations`)
	}

	const mistralVendor = new MistralVendor()
	const mistralConversations = await mistralVendor.listConversations()

	return {
		response: json(mistralConversations as GetVendorConversationsResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorConversations)
}
