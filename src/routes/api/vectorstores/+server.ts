import { json, type RequestHandler } from "@sveltejs/kit"
import { MistralVendor } from "$lib/server/mistral/mistral"

export const GET: RequestHandler = async () => {
	// Hent alle vector store caller har tilgang på og list de opp med navn og besrivelse. Admin kan få absolutt alle gitt. Vil ha med hvilken agent de er knyttet til evt, eller om de er knyttet til en conversation. eller om de er standalone
	const mistralVendor = new MistralVendor()
	const mistralVectorStores = await mistralVendor.listVectorStores()
	// Kanskje greiest å bare implemenetere per leverandør statisk her først?
	return json(mistralVectorStores)
}

export const POST: RequestHandler = async () => {
	// Slett en vector store
	throw new Error("Not implemented yet")
}
