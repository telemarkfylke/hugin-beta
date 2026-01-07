import type { RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import { canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import type { VendorId } from "$lib/types/vendor-ids"

const deleteVendorVectorStoreFile: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	const { vendorId, vectorstoreId, fileId } = requestEvent.params
	if (!vendorId || !vectorstoreId || !fileId) {
		throw new HTTPError(400, "vendorId vectorstoreId and fileId are required")
	}

	const vendor = createVendor(vendorId as VendorId)
	await vendor.deleteVectorStoreFile(vectorstoreId, fileId)

	return {
		response: new Response(),
		isAuthorized: true
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, deleteVendorVectorStoreFile)
}
