import { json, type RequestHandler } from "@sveltejs/kit"
import { getVendor } from "$lib/server/ai-vendors"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ChatRequest } from "$lib/types/chat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { parseChatConfig } from "$lib/validation/parse-chat-config"
import { validateFileInputs } from "$lib/validation/file-input"

const parseChatRequest = (body: unknown): ChatRequest => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const incomingChatRequest: ChatRequest = body as ChatRequest

	const config = parseChatConfig(incomingChatRequest.config, APP_CONFIG)

	if (!Array.isArray(incomingChatRequest.inputs) || incomingChatRequest.inputs.length === 0) {
		throw new HTTPError(400, "inputs must be a non-empty array")
	}
	if (config.vendorAgent) {
		return {
			config,
			inputs: incomingChatRequest.inputs,
			stream: Boolean(incomingChatRequest.stream)
		}
	}

	const manualChatRequest: ChatRequest = {
		config,
		inputs: incomingChatRequest.inputs,
		stream: Boolean(incomingChatRequest.stream)
	}

	validateFileInputs(manualChatRequest, APP_CONFIG)

	return manualChatRequest
}

const supahChat: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatRequest = parseChatRequest(body)

	// Check authorization here - what should be checked is if user has access to vendor-agent-id in predefined configs and eventually access to vector stores

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
