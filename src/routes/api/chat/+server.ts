import { json, type RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import type { ChatConfig } from "$lib/types/chat"
import { getVendor } from "$lib/server/agents/ai-vendors"

const getChatConfig = (body: unknown): ChatConfig => {
	if (typeof body !== "object" || body === null) {
		throw new HTTPError(400, "Invalid chat config")
	}
	const expectedChatConfig: ChatConfig = body as ChatConfig

	if (!expectedChatConfig.vendorId || typeof expectedChatConfig.vendorId !== "string") {
		throw new HTTPError(400, "vendorId is required and must be a string")
	}
	if (!expectedChatConfig.inputs || !Array.isArray(expectedChatConfig.inputs)) {
		throw new HTTPError(400, "inputs is required and must be an array")
	}
	if (expectedChatConfig.vendorAgent) {
		// Predefined config
		if (typeof expectedChatConfig.vendorAgent.id !== "string") {
			throw new HTTPError(400, "vendorAgent.id must be a string")
		}
		if (expectedChatConfig.stream !== undefined) {
			if (typeof expectedChatConfig.stream !== "boolean") {
				throw new HTTPError(400, "stream must be a boolean")
			}
		}
		return {
			vendorId: expectedChatConfig.vendorId,
			inputs: expectedChatConfig.inputs,
			vendorAgent: {
				id: expectedChatConfig.vendorAgent.id
			},
			stream: Boolean(expectedChatConfig.stream)
		}
	}
	// Manual config
	if (!expectedChatConfig.model || typeof expectedChatConfig.model !== "string") {
		throw new HTTPError(400, "model is required and must be a string")
	}
	const manualChatConfig: ChatConfig = {
		vendorId: expectedChatConfig.vendorId,
		inputs: expectedChatConfig.inputs,
		model: expectedChatConfig.model,
	}
	if (expectedChatConfig.instructions) {
		if (typeof expectedChatConfig.instructions !== "string") {
			throw new HTTPError(400, "instructions must be a string")
		}
		manualChatConfig.instructions = expectedChatConfig.instructions
	}
	if (expectedChatConfig.conversationId) {
		if (typeof expectedChatConfig.conversationId !== "string") {
			throw new HTTPError(400, "conversationId must be a string")
		}
		manualChatConfig.conversationId = expectedChatConfig.conversationId
	}
	if (expectedChatConfig.stream !== undefined) {
		if (typeof expectedChatConfig.stream !== "boolean") {
			throw new HTTPError(400, "stream must be a boolean")
		}
		manualChatConfig.stream = expectedChatConfig.stream
	}
	if (expectedChatConfig.tools) {
		if (!Array.isArray(expectedChatConfig.tools)) {
			throw new HTTPError(400, "tools must be an array of tools")
		}
		manualChatConfig.tools = expectedChatConfig.tools
	}
	return manualChatConfig
}


const chatConfig: ChatConfig = {
	vendorId: "openai",
	model: "gpt-4o",
	inputs: [
	 {
		type: "message",
		role: "user",
		content: [
			{
				type: "input_text",
				text: "Tell me a joke about programming"
			}
		]
	 }
	]
}

const supahChat: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const body = await requestEvent.request.json()

	const chatConfig = await getChatConfig(body)

	const vendor = getVendor(chatConfig.vendorId)

	if (chatConfig.stream) {
		const stream = await vendor.createChatResponseStream(chatConfig)

		// Så kan vi sikkert lage en kopi av streamen for å lagre i db eller noe også her (hvis det er en conversatonId eller noe sånt og store ikke er false)
		return {
			isAuthorized: true,
			response: responseStream(stream)
		}
	}

	const response = await vendor.createChatResponse(chatConfig)

	// Save to db and check stuff or whatever here

	return {
		isAuthorized: true,
		response: json(response)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, supahChat)
}
