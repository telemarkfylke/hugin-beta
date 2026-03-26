import OpenAI from "openai"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { chatInputToCompletionMessage, litellmResponseToChatResponseObject } from "./litellm-mapping"
import { handleLitellmChatStream } from "./litellm-stream"

const getLitellmBaseUrl = (): string => {
	if (!env.LITELLM_BASE_URL) {
		throw new Error("LITELLM_BASE_URL environment variable is not set")
	}
	return env.LITELLM_BASE_URL
}

const buildCompletionRequest = (chatRequest: ChatRequest): ChatCompletionCreateParamsBase => {
	if (!chatRequest.config.model) {
		throw new Error("Model is required for LiteLLM vendor")
	}

	const messages = chatRequest.inputs.map(chatInputToCompletionMessage)

	if (chatRequest.config.instructions) {
		messages.unshift({ role: "system", content: chatRequest.config.instructions })
	}

	return {
		model: chatRequest.config.model,
		messages
	}
}

const getClient = (): OpenAI => {
	return new OpenAI({
		baseURL: getLitellmBaseUrl(),
		apiKey: env.LITELLM_API_KEY || "no-key"
	})
}

export class LitellmVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const client = getClient()
		const response = await client.chat.completions.create({
			...buildCompletionRequest(chatRequest),
			stream: false
		})
		return litellmResponseToChatResponseObject(chatRequest.config, response)
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const client = getClient()
		const responseStream = await client.chat.completions.create({
			...buildCompletionRequest(chatRequest),
			stream: true,
			stream_options: { include_usage: true }
		})
		return handleLitellmChatStream(chatRequest, responseStream)
	}
}
