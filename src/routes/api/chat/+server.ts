import { json, type RequestHandler } from "@sveltejs/kit"
import { canPromptConfig } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatRequest } from "$lib/validation/parse-chat-request"

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const contentLength = Number(requestEvent.request.headers.get("content-length") || 0)
	if (contentLength > APP_CONFIG.BODY_SIZE_LIMIT_BYTES) {
		throw new HTTPError(413, `Request body is too large. Limit is ${APP_CONFIG.BODY_SIZE_LIMIT_BYTES} bytes.`)
	}

	let body: unknown
	try {
		body = await requestEvent.request.json()
	} catch (error) {
		if (error instanceof Error && /too large|body size|request entity|payload/i.test(error.message)) {
			throw new HTTPError(413, `Request body is too large. Limit is ${APP_CONFIG.BODY_SIZE_LIMIT_BYTES} bytes.`)
		}
		throw new HTTPError(400, "Invalid JSON request body")
	}

	const chatRequest = parseChatRequest(body, APP_CONFIG)

	if (!canPromptConfig(user, APP_CONFIG, chatRequest.config)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	const vendor = getVendor(chatRequest.config.vendorId)

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)

		// Så kan vi sikkert lage en kopi av streamen for å lagre i db eller noe også her (hvis det er en conversatonId eller noe sånt og store ikke er false)
		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(chatRequest)

	// Save to db and check stuff or whatever here

	return {
		isAuthorized: true,
		response: json(response)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
