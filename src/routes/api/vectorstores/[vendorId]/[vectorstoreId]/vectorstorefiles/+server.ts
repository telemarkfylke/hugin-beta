import { json, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import type { GetVendorVectorStoreFilesResponse } from "$lib/types/api-responses"
import type { VendorId } from "$lib/types/vendor-ids"

const getVendorVectorStoreFiles: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const { vendorId, vectorstoreId } = requestEvent.params
	if (!vendorId || !vectorstoreId) {
		throw new HTTPError(400, "vendorId and vectorstoreId are required")
	}

	const vendor = createVendor(vendorId as VendorId)
	const vectorStoreFiles = await vendor.getVectorStoreFiles(vectorstoreId)

	return {
		response: json(vectorStoreFiles as GetVendorVectorStoreFilesResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStoreFiles)
}
