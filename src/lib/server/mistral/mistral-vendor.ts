import { Mistral } from "@mistralai/mistralai"
import type { ConversationRequest } from "@mistralai/mistralai/models/components"
import { env } from "$env/dynamic/private"
import { externalErrorToHTTPError } from "$lib/server/middleware/external-error"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { APP_CONFIG } from "../app-config/app-config"
import { chatInputToMistralInput, mistralResponseToChatResponseObject } from "./mistral-mapping"
import { handleMistralResponseStream } from "./mistral-stream"

const MISTRAL_SUPPORTED_MODELS = APP_CONFIG.VENDORS.MISTRAL.MODELS.map((model) => model.ID)

const mistralRequest = async (mistral: Mistral, chatRequest: ChatRequest): Promise<ConversationRequest> => {
	const tools = chatRequest.config.tools?.map((tool) => {
		if (tool.type === "web_search") {
			return { type: "web_search" as const }
		}
		return tool
	})

	const baseConfig: ConversationRequest = {
		inputs: await Promise.all(chatRequest.inputs.map((input) => chatInputToMistralInput(mistral, input))),
		store: false,
		...(tools ? { tools } : {})
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

const getApiKeyForProject = (project: string): string => {
	const PROJECT_API_KEY = env[`MISTRAL_API_KEY_PROJECT_${project}`]
	if (!PROJECT_API_KEY) {
		throw new Error(`No Mistral API key found for project ${project}`)
	}
	return PROJECT_API_KEY
}

export class MistralVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const mistral = new Mistral({
			apiKey: PROJECT_API_KEY
		})

		try {
			const response = await mistral.beta.conversations.start({
				...(await mistralRequest(mistral, chatRequest)),
				stream: false
			})
			return mistralResponseToChatResponseObject(chatRequest.config, response)
		} catch (error) {
			throw externalErrorToHTTPError(error, "Mistral") ?? error
		}
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const mistral = new Mistral({
			apiKey: PROJECT_API_KEY
		})

		try {
			const responseStream = await mistral.beta.conversations.startStream({
				...(await mistralRequest(mistral, chatRequest)),
				stream: true
			})
			return handleMistralResponseStream(chatRequest, responseStream)
		} catch (error) {
			throw externalErrorToHTTPError(error, "Mistral") ?? error
		}
	}
}
