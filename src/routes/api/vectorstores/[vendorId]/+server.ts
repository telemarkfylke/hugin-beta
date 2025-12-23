import { json, type RequestHandler } from "@sveltejs/kit"
import { canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { MistralVendor } from "$lib/server/mistral/mistral"
import type { GetVectorStoresResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import OpenAI from "openai"
import { OpenAIVendor } from "$lib/server/openai/openai"
import type { VendorId } from "$lib/types/vendor-ids"
import { createVendor } from "$lib/server/agents/vendors"

const getVendorVectorStores: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}

	const { vendorId } = requestEvent.params
	if (!vendorId) {
		throw new HTTPError(400, "vendorId are required")
	}
	const vendor = createVendor(vendorId as VendorId)
	const vectorStores = await vendor.listVectorStores()
	return {
		response: json(vectorStores  as GetVectorStoresResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStores)
}