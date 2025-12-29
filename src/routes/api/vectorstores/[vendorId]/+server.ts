import { json, type RequestEvent, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canManageVendorVectorStores, canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { GetVectorStoresResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import type { VendorId } from "$lib/types/vendor-ids"

type VectorStoreInput = {
	name: string
	description: string
}

const extractVendor = (requestEvent: RequestEvent) => {
	const { vendorId } = requestEvent.params
	if (!vendorId) {
		throw new HTTPError(400, "vendorId are required")
	}
	return createVendor(vendorId as VendorId)
}

const getVendorVectorStores: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const vendor = extractVendor(requestEvent)
	const vectorStores = await vendor.listVectorStores()
	return {
		response: json(vectorStores as GetVectorStoresResponse),
		isAuthorized: true
	}
}

const postVectorStore: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canManageVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to manage vendor vector stores`)
	}
	const vendor = extractVendor(requestEvent)
	const input: VectorStoreInput = await requestEvent.request.json()

	const reply = vendor.addVectorStore(input.name, input.description)
	return {
		response: json(reply),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStores)
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, postVectorStore)
}
