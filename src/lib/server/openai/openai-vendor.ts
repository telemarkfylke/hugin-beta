import OpenAI from "openai"
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses.mjs"
import { env } from "$env/dynamic/private"
import type { AIVendor, IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { handleOpenAIResponseStream } from "./openai-stream"
import { chatInputToOpenAIInput, openAiResponseToChatResponseObject } from "./openai-mapping"
import { OPEN_AI_VENDOR_ID } from "$lib/vendor-constants"


if (!env.SUPPORTED_MODELS_VENDOR_OPENAI || env.SUPPORTED_MODELS_VENDOR_OPENAI.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_OPENAI is not set in environment variables")
}
const OPEN_AI_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_OPENAI.split(",").map((model) => model.trim())
const OPEN_AI_DEFAULT_MODEL = OPEN_AI_SUPPORTED_MODELS[0] as string

export const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY || "bare-en-tulle-key"
})

const openAiRequest = (chatRequest: ChatRequest): ResponseCreateParamsBase => {
	const baseConfig: ResponseCreateParamsBase = {
		input: chatRequest.inputs.map(chatInputToOpenAIInput),
		store: false
	}
	console.log("chatRequest.config:", JSON.stringify(baseConfig.input), null, 2)
	if (chatRequest.config.vendorAgent) {
		if (!chatRequest.config.vendorAgent.id) {
			throw new Error("vendorAgent with valid id is required for predefined agent chat config")
		}
		return {
			prompt: {
				id: chatRequest.config.vendorAgent.id
			},
			...baseConfig
		}
	}
	if (!chatRequest.config.model) {
		throw new Error("Model is required for manual chat config")
	}
	if (!OPEN_AI_SUPPORTED_MODELS.includes(chatRequest.config.model)) {
		throw new Error(`Model ${chatRequest.config.model} is not supported by OpenAI vendor`)
	}
	return {
		model: chatRequest.config.model,
		instructions: chatRequest.config.instructions || "",
		...baseConfig
	}
}

export class OpenAIVendor implements IAIVendor {
	public getInfo(): AIVendor {
		return {
			id: OPEN_AI_VENDOR_ID,
			name: "OpenAI",
			description: "OpenAI - jauda",
			models: {
				supported: OPEN_AI_SUPPORTED_MODELS,
				default: OPEN_AI_DEFAULT_MODEL
			}
		}
	}

	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const response = await openai.responses.create({
			...openAiRequest(chatRequest),
			stream: false
		})
		return openAiResponseToChatResponseObject(chatRequest.config, response)
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const responseStream = await openai.responses.create({
			...openAiRequest(chatRequest),
			stream: true
		})
		return handleOpenAIResponseStream(chatRequest, responseStream)
	}
}
