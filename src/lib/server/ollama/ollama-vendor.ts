import type { Message, ChatRequest as OllamaChatRequest } from "ollama"
import { Ollama } from "ollama"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { chatInputToOllamaMessage, ollamaResponseToChatResponseObject } from "./ollama-mapping"
import { handleOllamaChatStream } from "./ollama-stream"

const getOllamaHost = (): string => {
	if (!env.OLLAMA_HOST) {
		throw new Error("OLLAMA_HOST environment variable is not set")
	}
	return `${env.OLLAMA_HOST}`
}

const buildOllamaRequest = (chatRequest: ChatRequest): Omit<OllamaChatRequest, "stream"> => {
	if (!chatRequest.config.model) {
		throw new Error("Model is required for Ollama vendor")
	}

	const messages: Message[] = chatRequest.inputs.map(chatInputToOllamaMessage)

	if (chatRequest.config.instructions) {
		messages.unshift({ role: "system", content: chatRequest.config.instructions })
	}

	return {
		model: chatRequest.config.model,
		messages
	}
}

export class OllamaAIVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const ollama = new Ollama({ host: getOllamaHost() })
		const response = await ollama.chat({
			...buildOllamaRequest(chatRequest),
			stream: false
		})
		return ollamaResponseToChatResponseObject(chatRequest.config, response, crypto.randomUUID())
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const ollama = new Ollama({ host: getOllamaHost() })
		const responseStream = await ollama.chat({
			...buildOllamaRequest(chatRequest),
			stream: true
		})
		return handleOllamaChatStream(chatRequest, responseStream)
	}
}
