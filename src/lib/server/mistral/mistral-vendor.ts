import { Mistral } from "@mistralai/mistralai"
import { env } from "$env/dynamic/private"
import type { ConversationRequest, ConversationResponse, InputEntries, MessageInputContentChunks } from "@mistralai/mistralai/models/components"
import type { ChatConfig, ChatInput, ChatOutput, ChatResponseObject, ChatTool } from "$lib/types/chat"
import type { AIVendor, IAIVendor } from "$lib/types/AIVendor"

if (!env.SUPPORTED_MODELS_VENDOR_MISTRAL || env.SUPPORTED_MODELS_VENDOR_MISTRAL.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_MISTRAL is not set in environment variables")
}
const MISTRAL_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_MISTRAL.split(",").map((model) => model.trim())
const MISTRAL_DEFAULT_MODEL = MISTRAL_SUPPORTED_MODELS[0] as string

export const mistral = new Mistral({
	apiKey: env.MISTRAL_API_KEY || "bare-en-tulle-key"
})

const chatInputToMistralInput = (input: ChatInput): InputEntries => {
	switch (input.type) {
		case "message": {
			const role = input.role === "assistant" ? "assistant" : "user"
			const type = role === "assistant" ? "message.output" : "message.input"
			return {
				type,
				role,
				content: input.content.map<MessageInputContentChunks>(part => {
					switch (part.type) {
						case "input_text": {
							return {
								type: "text",
								text: part.text	
							}
						}
						case "input_file": {
							return {
								type: "document_url",
								documentUrl: part.file_url || "url_missing",
								documentName: part.filename || "unknown"
							}
						}
						case "input_image": {
							return {
								type: "image_url",
								imageUrl: part.image_url || "url_missing",
							}
						}
						default: {
							return {
								type: "text",
								text: "[Unsupported content type]"
							}
						}
					}
				})
			} as InputEntries
		}
		default: {
			throw new Error(`Unsupported ChatInput type for Mistral: ${input.type}`)
		}
	}
}

// Helper type
type MistralTool = Exclude<ConversationRequest["tools"], undefined | null>[number];

const chatConfigToolToMistralTool = (tool: ChatTool): MistralTool => {
	switch (tool.type) {
		case "file_search": {
			return {
				type: "document_library",
				libraryIds: tool.vector_store_ids
			}
		}
		default: {
			throw new Error(`Unsupported ChatTool type for Mistral: ${tool.type}`)
		}
	}
}

const mistralConfig = (config: ChatConfig): ConversationRequest => {
	const baseConfig: ConversationRequest = {
		store: false,
		inputs: config.inputs.map(chatInputToMistralInput)
	}
	if (config.vendorAgent) {
		if (!config.vendorAgent.id) {
			throw new Error("vendorAgent with valid id is required for predefined agent chat config")
		}
		return {
			agentId: config.vendorAgent.id,
			...baseConfig
		}
	}
	if (!config.model) {
		throw new Error("Model is required for manual chat config")
	}
	if (!MISTRAL_SUPPORTED_MODELS.includes(config.model)) {
		throw new Error(`Model ${config.model} is not supported by Mistral vendor`)
	}
	return {
		model: config.model,
		instructions: config.instructions || "",
		tools: config.tools?.map(chatConfigToolToMistralTool) || [],
		...baseConfig
	}
}

const mistralOutputToChatOutput = (output: ConversationResponse["outputs"][number]): ChatOutput => {
	switch (output.type) {
		case "message.output": {
			return {
				type: "message",
				id: output.id || "mistral_did_not_return_id",
				status: "completed",
				role: "assistant",
				content: typeof output.content === "string" ? [{ type: "output_text", text: output.content, annotations: [] }] : output.content.map<ChatOutput["content"][number]>(part => {
					switch (part.type) {
						case "text": {
							return {
								type: "output_text",
								text: part.text,
								annotations: []
							}
						}
						default: {
							throw new Error(`Unsupported Mistral output content type: ${part.type}`)
						}
					}
				})
			}
		}
		default: {
			throw new Error(`Unsupported Mistral output type: ${output.type}`)
		}
	}
}

const mistralResponseToChatResponseObject = (response: ConversationResponse): ChatResponseObject => {
	const outputs: ChatOutput[] = response.outputs.map(mistralOutputToChatOutput)
	return {
		id: response.conversationId,
		type: "chat_response",
		vendorId: "mistral",
		createdAt: new Date().toISOString(),
		outputs,
		status: "completed",
		usage: {
			inputTokens: response.usage?.promptTokens || 0,
			outputTokens: response.usage?.completionTokens || 0,
			totalTokens: response.usage?.totalTokens || 0
		}
	}
}

export class MistralVendor implements IAIVendor {
	public getInfo(): AIVendor {
		return {
			id: "mistral",
			name: "Mistral",
			description: "Mistral - sacre bleu",
			models: {
				supported: MISTRAL_SUPPORTED_MODELS,
				default: MISTRAL_DEFAULT_MODEL
			}
		}
	}

	public async createChatResponse(config: ChatConfig): Promise<ChatResponseObject> {
		const response = await mistral.beta.conversations.start({
			...mistralConfig(config),
			stream: true
		})
		return mistralResponseToChatResponseObject(response)
	}

	public async createChatResponseStream(config: ChatConfig): Promise<ChatResponseStream> {
		const responseStream = await mistral.beta.conversations.startStream({
			...mistralConfig(config),
			stream: true
		})
		return handleMistralResponseStream(responseStream)
	}
}
