import { json, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import type { VendorId } from "$lib/types/vendor-ids"

export const DELETE: RequestHandler = async ({ params }) => {
	const vendorId = params.vendorId as VendorId
	if (!vendorId) {
		return json({ error: "vendorId is required" }, { status: 400 })
	}
	const conversationId = params.conversationId
	if (!conversationId) {
		return json({ error: "conversationId is required" }, { status: 400 })
	}
	// Sjekk om har tilgang (noe middleware)
	const vendor = createVendor(vendorId)
	await vendor.deleteConversation(conversationId)

	return new Response(null, { status: 204 })
}
