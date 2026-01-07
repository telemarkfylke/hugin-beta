import OpenAI from "openai"
import type { Response } from "openai/resources/responses/responses.js"
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses.mjs"
import { env } from "$env/dynamic/private"
import type { AIVendor, IAIVendor } from "$lib/types/AIVendor"
import type { ChatConfig, ChatOutput, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { handleOpenAIResponseStream } from "./openai-stream"

if (!env.SUPPORTED_MODELS_VENDOR_OPENAI || env.SUPPORTED_MODELS_VENDOR_OPENAI.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_OPENAI is not set in environment variables")
}
const OPEN_AI_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_OPENAI.split(",").map((model) => model.trim())
const OPEN_AI_DEFAULT_MODEL = OPEN_AI_SUPPORTED_MODELS[0] as string

export const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY || "bare-en-tulle-key"
})

const openAiConfig = (config: ChatConfig): ResponseCreateParamsBase => {
	const baseConfig: ResponseCreateParamsBase = {
		input: config.inputs.filter((input) => input.type !== "unknown"),
		store: false
	}
	if (config.vendorAgent) {
		if (!config.vendorAgent.id) {
			throw new Error("vendorAgent with valid id is required for predefined agent chat config")
		}
		return {
			prompt: {
				id: config.vendorAgent.id
			},
			...baseConfig
		}
	}
	if (!config.model) {
		throw new Error("Model is required for manual chat config")
	}
	if (!OPEN_AI_SUPPORTED_MODELS.includes(config.model)) {
		throw new Error(`Model ${config.model} is not supported by OpenAI vendor`)
	}
	return {
		model: config.model,
		instructions: config.instructions || "",
		tools: config.tools || [],
		...baseConfig
	}
}

const openAiResponseToChatResponseObject = (response: Response): ChatResponseObject => {
	const outputs: ChatOutput[] = response.output.map((output) => {
		if (output.type === "message") {
			return output
		}
		return {
			type: "unknown",
			data: output
		}
	})
	return {
		id: response.id,
		type: "chat_response",
		vendorId: "openai",
		createdAt: new Date(response.created_at).toISOString(),
		outputs,
		status: response.status || "incomplete",
		usage: {
			inputTokens: response.usage?.input_tokens || 0,
			outputTokens: response.usage?.output_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0
		}
	}
}

export class OpenAIVendor implements IAIVendor {
	public getInfo(): AIVendor {
		return {
			id: "openai",
			name: "OpenAI",
			description: "OpenAI - jauda",
			models: {
				supported: OPEN_AI_SUPPORTED_MODELS,
				default: OPEN_AI_DEFAULT_MODEL
			}
		}
	}

	public async createChatResponse(config: ChatConfig): Promise<ChatResponseObject> {
		const response = await openai.responses.create({
			...openAiConfig(config),
			stream: false
		})
		return openAiResponseToChatResponseObject(response)
	}

	public async createChatResponseStream(config: ChatConfig): Promise<ChatResponseStream> {
		const responseStream = await openai.responses.create({
			...openAiConfig(config),
			stream: true
		})
		return handleOpenAIResponseStream(responseStream)
	}
}
