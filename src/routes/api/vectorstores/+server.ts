import { json, type RequestHandler } from "@sveltejs/kit"
import { canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { MistralVendor } from "$lib/server/mistral/mistral"

const getVendorVectorStores: MiddlewareNextFunction = async ({ user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	// Kanskje greiest å bare implemenetere per leverandør statisk her først?
	const mistralVendor = new MistralVendor()
	const mistralVectorStores = await mistralVendor.listVectorStores()
	return {
		response: json(mistralVectorStores),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStores)
}
