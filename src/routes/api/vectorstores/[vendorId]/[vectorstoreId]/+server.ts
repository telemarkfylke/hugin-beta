import { json, type RequestHandler } from "@sveltejs/kit"
import { createVendor } from "$lib/server/agents/vendors"
import type { VendorId } from "$lib/types/vendor-ids"

export const GET: RequestHandler = async ({ params }) => {
	const vendorId = params.vendorId as VendorId
	if (!vendorId) {
		return json({ error: "vendorId is required" }, { status: 400 })
	}
	const vectorstoreId = params.vectorstoreId
	if (!vectorstoreId) {
		return json({ error: "vectorstoreId is required" }, { status: 400 })
	}
	// Sjekk om har tilgang (noe middleware)

	const vendor = createVendor(vendorId)
	// Hent en vector store og list opp filer
	const vectorStore = await vendor.getVectorStore(vectorstoreId)

	return json(vectorStore)
}

export const DELETE: RequestHandler = async ({ params }) => {
	const vendorId = params.vendorId as VendorId
	if (!vendorId) {
		return json({ error: "vendorId is required" }, { status: 400 })
	}
	const vectorstoreId = params.vectorstoreId
	if (!vectorstoreId) {
		return json({ error: "vectorstoreId is required" }, { status: 400 })
	}
	// Sjekk om har tilgang (noe middleware)
	const vendor = createVendor(vendorId)
	await vendor.deleteVectorStore(vectorstoreId)

	return new Response(null, { status: 204 })
}
