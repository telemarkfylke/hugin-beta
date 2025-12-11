import { json, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canDeleteVendorVectorStore, canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { GetVendorVectorStoreResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import type { VendorId } from "$lib/types/vendor-ids"

const getVendorVectorStore: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const { vendorId, vectorstoreId } = requestEvent.params
	if (!vendorId || !vectorstoreId) {
		throw new HTTPError(400, "vendorId and vectorstoreId are required")
	}

	const vendor = createVendor(vendorId as VendorId)
	const vectorStore = await vendor.getVectorStore(vectorstoreId)

	return {
		response: json(vectorStore as GetVendorVectorStoreResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStore)
}

const deleteVendorVectorStore: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canDeleteVendorVectorStore(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to delete vendor vector stores`)
	}
	const { vendorId, vectorstoreId } = requestEvent.params
	if (!vendorId || !vectorstoreId) {
		throw new HTTPError(400, "vendorId and vectorstoreId are required")
	}
	const vendor = createVendor(vendorId as VendorId)
	await vendor.deleteVectorStore(vectorstoreId)

	return {
		response: new Response(null, { status: 204 }),
		isAuthorized: true
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, deleteVendorVectorStore)
}
