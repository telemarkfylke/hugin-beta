import OpenAI from "openai"
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses.mjs"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { APP_CONFIG } from "../app-config/app-config"
import { chatInputToOpenAIInput, openAiResponseToChatResponseObject } from "./openai-mapping"
import { handleOpenAIResponseStream } from "./openai-stream"

const OPEN_AI_SUPPORTED_MODELS = APP_CONFIG.VENDORS.OPENAI.MODELS.map((model) => model.ID)

const openAiRequest = (chatRequest: ChatRequest): ResponseCreateParamsBase => {
	const baseConfig: ResponseCreateParamsBase = {
		input: chatRequest.inputs.map(chatInputToOpenAIInput),
		store: false
	}
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

const getApiKeyForProject = (project: string): string => {
	const PROJECT_API_KEY = env[`OPENAI_API_KEY_PROJECT_${project}`]
	if (!PROJECT_API_KEY) {
		throw new Error(`No OpenAI API key found for project ${project}`)
	}
	return PROJECT_API_KEY
}

export class OpenAIVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const openai = new OpenAI({
			apiKey: PROJECT_API_KEY
		})
		const response = await openai.responses.create({
			...openAiRequest(chatRequest),
			stream: false
		})
		return openAiResponseToChatResponseObject(chatRequest.config, response)
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const openai = new OpenAI({
			apiKey: PROJECT_API_KEY
		})
		const responseStream = await openai.responses.create({
			...openAiRequest(chatRequest),
			stream: true
		})
		return handleOpenAIResponseStream(chatRequest, responseStream)
	}
}
