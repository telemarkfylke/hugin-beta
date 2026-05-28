import { json, type RequestHandler } from "@sveltejs/kit"
import { canPromptConfig } from "$lib/authorization"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatRequest } from "$lib/validation/parse-chat-request"

const chatConfigStore = getChatConfigStore()

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

	// Always verify authorization against the database record, not the client-supplied config.
	// The client must not be trusted to supply correct shared/accessGroups/type values.
	const dbConfig = await chatConfigStore.getChatConfig(chatRequest.config._id)
	if (!dbConfig) {
		throw new HTTPError(404, "Chat configuration not found")
	}

	if (!canPromptConfig(user, APP_CONFIG, dbConfig)) {
		throw new HTTPError(403, "Not authorized to use this chat configuration")
	}

	// Use the DB config as authoritative. Carry over only conversationId — session state
	// maintained by the client across turns.
	const resolvedConfig = { ...dbConfig, conversationId: chatRequest.config.conversationId }
	const resolvedRequest = { ...chatRequest, config: resolvedConfig }

	const vendor = getVendor(resolvedRequest.config.vendorId)

	if (resolvedRequest.stream) {
		const stream = await vendor.createChatResponseStream(resolvedRequest)
		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(resolvedRequest)

	return {
		isAuthorized: true,
		response: json(response)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, supahChat)
}
