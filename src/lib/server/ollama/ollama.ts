import { type AbortableAsyncIterator, type ChatResponse, Ollama } from "ollama"
import { createSse } from "$lib/streaming.js"
import type { Conversation, Message, OllamaAIResponseConfig } from "$lib/types/agents"

type OllamaResponse = ChatResponse | AbortableAsyncIterator<ChatResponse>

const ollama = new Ollama({ host: "http://127.0.0.1:11434" })

export type OllamaCreateResponse = {
	ollamaConversationId: string
	response: OllamaResponse
	messages: Message[]
}

export const handleOllamaStream = (conversation: Conversation, stream: AbortableAsyncIterator<ChatResponse>, conversationId?: string): ReadableStream => {
	const readableStream = new ReadableStream({
		async start(controller) {
			let message = ""
			const messageId = crypto.randomUUID()

			if (conversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId } }))
			}

			for await (const part of stream) {
				controller.enqueue(createSse({ event: "conversation.message.delta", data: { messageId: messageId, content: part.message.content } }))
				message += part.message.content
			}

			addMessage(message, conversation.messages, "agent", "outputText")
			controller.close()
		}
	})
	return readableStream
}

type OllamaMessage = {
	role: string
	content: string
}

const addMessage = (prompt: string, messages: Message[], originator: "user" | "agent", contentType: "inputText" | "outputText") => {
	if (!messages) {
		messages = []
	}
	const msg: Message = {
		id: crypto.randomUUID(),
		type: "message",
		status: "completed",
		role: originator,
		content: {
			text: prompt,
			type: contentType
		}
	}
	messages.push(msg)
}

const makeOllamaInstance = async (ollamaResponseConfig: OllamaAIResponseConfig, messages: OllamaMessage[], streamResponse: boolean): Promise<OllamaResponse> => {
	/*
   Dette er snedig, istedenfor multiple response verdier har de haller laget hardkodede versjoner av 
   chat for stream er enten true eller false, men det er ikke en boolean
  */
	const response = streamResponse
		? await ollama.chat({
				model: ollamaResponseConfig.model,
				messages: messages,
				stream: true
			})
		: await ollama.chat({
				model: ollamaResponseConfig.model,
				messages: messages,
				stream: false
			})

	return response
}

const convertToOllamaMessages = (messages: Message[]): OllamaMessage[] => {
  return messages.map((value: Message) => {
		return { role: value.role === 'agent' ? 'assistant' : value.role, content: value.content.text }
	})
}

export const createOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, prompt: string, streamResponse: boolean): Promise<OllamaCreateResponse> => {
	const messages: Message[] = []
	addMessage(prompt, messages, "user", "inputText")
	const response = await makeOllamaInstance(ollamaResponseConfig, convertToOllamaMessages(messages), streamResponse)
	const reply: OllamaCreateResponse = {
		ollamaConversationId: crypto.randomUUID(),
		response: response,
		messages: messages
	}
	return reply
}

export const appendToOllamaConversation = async (ollamaResponseConfig: OllamaAIResponseConfig, conversation: Conversation, prompt: string, streamResponse: boolean): Promise<OllamaResponse> => {
	addMessage(prompt, conversation.messages, "user", "inputText")
	const response = await makeOllamaInstance(ollamaResponseConfig,  convertToOllamaMessages(conversation.messages), streamResponse)
	return response
}
