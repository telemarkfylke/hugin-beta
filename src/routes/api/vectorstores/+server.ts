import { json, type RequestHandler } from "@sveltejs/kit"
import { canViewVendorVectorStores } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { MistralVendor } from "$lib/server/mistral/mistral"
import { OllamaVendor } from "$lib/server/ollama/ollama"
import { OpenAIVendor } from "$lib/server/openai/openai"
import type { GetVectorStoresResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const getVendorVectorStores: MiddlewareNextFunction = async ({ user }) => {
	if (!canViewVendorVectorStores(user)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to view vendor vector stores`)
	}
	// Kanskje greiest å bare implemenetere per leverandør statisk her først?
	const mistralVendor = new MistralVendor()
	const mistralVectorStores = await mistralVendor.listVectorStores()

	const openAiVendor = new OpenAIVendor()
	const openAiVectorStores = await openAiVendor.listVectorStores()

	const ollamaVendor = new OllamaVendor()
	const ollamaVectorStores = await ollamaVendor.listVectorStores()
	const response: GetVectorStoresResponse = { vectorstores: [...openAiVectorStores.vectorstores, ...mistralVectorStores.vectorstores, ...ollamaVectorStores.vectorstores] }

	return {
		response: json(response),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getVendorVectorStores)
}
