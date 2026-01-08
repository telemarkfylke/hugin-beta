import { json, type RequestHandler } from "@sveltejs/kit"
import { getVendor } from "$lib/server/agents/ai-vendors"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { ChatConfig, ChatRequest } from "$lib/types/chat"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const parseChatRequest = (body: unknown): ChatRequest => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const incomingChatRequest: ChatRequest = body as ChatRequest

	const config = incomingChatRequest.config

	if (!config || typeof config !== "object") {
		throw new HTTPError(400, "config is required and must be an object")
	}

	if (!config.id || typeof config.id !== "string") {
		throw new HTTPError(400, "config.id is required and must be a string")
	}
	if (!config.name || typeof config.name !== "string") {
		throw new HTTPError(400, "config.name is required and must be a string")
	}
	if (!config.description || typeof config.description !== "string") {
		throw new HTTPError(400, "config.description is required and must be a string")
	}

	if (!config.vendorId || typeof config.vendorId !== "string") {
		throw new HTTPError(400, "vendorId is required and must be a string")
	}
	if (!incomingChatRequest.inputs || !Array.isArray(incomingChatRequest.inputs)) {
		throw new HTTPError(400, "inputs is required and must be an array")
	}
	if (config.vendorAgent) {
		// Predefined config
		if (typeof config.vendorAgent.id !== "string") {
			throw new HTTPError(400, "vendorAgent.id must be a string")
		}
		if (incomingChatRequest.stream !== undefined) {
			if (typeof incomingChatRequest.stream !== "boolean") {
				throw new HTTPError(400, "stream must be a boolean")
			}
		}
		return {
			config: {
				id: config.id,
				name: config.name,
				description: config.description,
				vendorId: config.vendorId,
				vendorAgent: {
					id: config.vendorAgent.id
				}
			},
			inputs: incomingChatRequest.inputs,
			stream: Boolean(incomingChatRequest.stream)
		}
	}
	// Manual config
	if (!config.model || typeof config.model !== "string") {
		throw new HTTPError(400, "model is required and must be a string")
	}
	const manualChatConfig: ChatConfig = {
		id: config.id,
		name: config.name,
		description: config.description,
		vendorId: config.vendorId,
		model: config.model
	}
	if (config.instructions) {
		if (typeof config.instructions !== "string") {
			throw new HTTPError(400, "instructions must be a string")
		}
		manualChatConfig.instructions = config.instructions
	}
	if (config.conversationId) {
		if (typeof config.conversationId !== "string") {
			throw new HTTPError(400, "conversationId must be a string")
		}
		manualChatConfig.conversationId = config.conversationId
	}
	if (incomingChatRequest.stream !== undefined) {
		if (typeof incomingChatRequest.stream !== "boolean") {
			throw new HTTPError(400, "stream must be a boolean")
		}
	}
	if (config.tools) {
		if (!Array.isArray(config.tools)) {
			throw new HTTPError(400, "tools must be an array of tools")
		}
		manualChatConfig.tools = config.tools
	}
	return {
		config: manualChatConfig,
		inputs: incomingChatRequest.inputs,
		stream: Boolean(incomingChatRequest.stream)
	}
}

const supahChat: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatRequest = parseChatRequest(body)

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
	return httpRequestMiddleware(requestEvent, supahChat)
}
