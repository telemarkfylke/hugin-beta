import { Mistral } from "@mistralai/mistralai"
import type { ConversationRequest } from "@mistralai/mistralai/models/components"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { APP_CONFIG } from "../app-config/app-config"
import { getLibraryMappingStore } from "../document-libraries/interfaces"
import { chatInputToMistralInput, mistralResponseToChatResponseObject } from "./mistral-mapping"
import { handleMistralResponseStream } from "./mistral-stream"

const MISTRAL_SUPPORTED_MODELS = APP_CONFIG.VENDORS.MISTRAL.MODELS.map((model) => model.ID)

const mistralRequest = async (chatRequest: ChatRequest): Promise<ConversationRequest> => {
	chatRequest.config.tools?.push({ type: "library_search" })

	const tools = []
	if (chatRequest.config.tools) {
		for (const tool of chatRequest.config.tools) {
			if (tool.type === "web_search") {
				tools.push({ type: "web_search" as const })
			}
			if (tool.type === "library_search") {
				const libStore = getLibraryMappingStore()
				const libraryIds = await libStore.getVendorIds(chatRequest.config._id, "Mistral")
				if (libraryIds.length > 0) {
					tools.push({ type: "document_library" as const, libraryIds: libraryIds })
				}
			}
		}
	}

	const baseConfig: ConversationRequest = {
		inputs: chatRequest.inputs.map(chatInputToMistralInput),
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

		const response = await mistral.beta.conversations.start({
			...(await mistralRequest(chatRequest)),
			stream: false
		})
		return mistralResponseToChatResponseObject(chatRequest.config, response)
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const PROJECT_API_KEY = getApiKeyForProject(chatRequest.config.project)
		const mistral = new Mistral({
			apiKey: PROJECT_API_KEY
		})

		// const libraries = await mistral.beta.libraries.list();

		const responseStream = await mistral.beta.conversations.startStream({
			...(await mistralRequest(chatRequest)),
			stream: true
		})
		return handleMistralResponseStream(chatRequest, responseStream)
	}
}
