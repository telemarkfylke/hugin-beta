import { Mistral } from "@mistralai/mistralai"
import type { ConversationRequest } from "@mistralai/mistralai/models/components"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { chatInputToMistralInput, mistralResponseToChatResponseObject } from "./mistral-mapping"
import { handleMistralResponseStream } from "./mistral-stream"
import { APP_CONFIG } from "../app-config/app-config"

const MISTRAL_SUPPORTED_MODELS = APP_CONFIG.VENDORS.MISTRAL.MODELS.map(model => model.ID)

export const mistral = new Mistral({
	apiKey: env.MISTRAL_API_KEY || "bare-en-tulle-key"
})

const mistralRequest = (chatRequest: ChatRequest): ConversationRequest => {
	const baseConfig: ConversationRequest = {
		inputs: chatRequest.inputs.map(chatInputToMistralInput),
		store: false
	}
	if (chatRequest.config.vendorAgent) {
		if (!chatRequest.config.vendorAgent.id) {
			throw new Error("vendorAgent with valid id is required for predefined agent chat config")
		}
		return {
			agentId: chatRequest.config.vendorAgent.id,
			...baseConfig
		}
	}
	if (!chatRequest.config.model) {
		throw new Error("Model is required for manual chat config")
	}
	if (!MISTRAL_SUPPORTED_MODELS.includes(chatRequest.config.model)) {
		throw new Error(`Model ${chatRequest.config.model} is not supported by Mistral vendor`)
	}
	return {
		model: chatRequest.config.model,
		instructions: chatRequest.config.instructions || "",
		...baseConfig
	}
}

export class MistralVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const response = await mistral.beta.conversations.start({
			...mistralRequest(chatRequest),
			stream: false
		})
		return mistralResponseToChatResponseObject(chatRequest.config, response)
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const responseStream = await mistral.beta.conversations.startStream({
			...mistralRequest(chatRequest),
			stream: true
		})
		return handleMistralResponseStream(chatRequest, responseStream)
	}
}
