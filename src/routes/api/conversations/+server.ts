import { json, type RequestHandler } from "@sveltejs/kit"
import { MistralVendor } from "$lib/server/mistral/mistral"

export const GET: RequestHandler = async () => {
	// Get DB conversations caller has access to

	// Get DB conversations as well here
	const mistralVendor = new MistralVendor()
	const mistralConversations = await mistralVendor.listConversations()
	return json(mistralConversations)
}
