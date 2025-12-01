import { type AbortableAsyncIterator, type ChatResponse, Ollama } from "ollama"
import { createSse } from "$lib/streaming.js"
import type {
	AddConversationFilesResult,
	Agent,
	AppendToConversationResult,
	Conversation,
	CreateConversationResult,
	DBAgent,
	GetConversationMessagesResult,
	GetConversationVectorStoreFileContentResult,
	IAgent,
	Message,
	OllamaAIResponseConfig
} from "$lib/types/agents"
import type { AgentPrompt, GetVectorStoreFilesResult } from "$lib/types/requests"

type OllamaResponse = ChatResponse | AbortableAsyncIterator<ChatResponse>
const ollama = new Ollama({ host: "http://127.0.0.1:11434" })

export type OllamaCreateResponse = {
	ollamaConversationId: string
	response: OllamaResponse
	messages: Message[]
}

export const handleOllamaStream = (conversation: Conversation, stream: AbortableAsyncIterator<ChatResponse>): ReadableStream => {
	const readableStream = new ReadableStream({
		async start(controller) {
			let message = ""
			const messageId = crypto.randomUUID()

			if (conversation._id) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId: conversation._id } }))
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

const addMessage = (prompt: AgentPrompt, messages: Message[], originator: "user" | "agent", contentType: "inputText" | "outputText") => {
	if (!messages) {
		messages = []
	}
	if (typeof prompt !== "string") {
		throw new Error("Only string prompts are supported for OllamaAgent for now")
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
		return { role: value.role === "agent" ? "assistant" : value.role, content: value.content.text }
	})
}

export class OllamaAgent implements IAgent {
	constructor(private dbAgent: DBAgent) {}

	public getAgentInfo(): Agent {
		throw new Error("Method not implemented in OllamaAgent")
	}

	public async createConversation(conversation: Conversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<CreateConversationResult> {
		addMessage(initialPrompt, conversation.messages, "user", "inputText")
		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config as OllamaAIResponseConfig, convertToOllamaMessages(conversation.messages), streamResponse)
		if (streamResponse) {
			return {
				relatedConversationId: crypto.randomUUID(),
				vectorStoreId: null,
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}

	public async appendMessageToConversation(conversation: Conversation, prompt: AgentPrompt, streamResponse: boolean): Promise<AppendToConversationResult> {
		addMessage(prompt, conversation.messages, "user", "inputText")
		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config as OllamaAIResponseConfig, convertToOllamaMessages(conversation.messages), streamResponse)
		if (streamResponse) {
			return {
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}
	public async addConversationVectorStoreFiles(_conversation: Conversation, _files: File[], _streamResponse: boolean): Promise<AddConversationFilesResult> {
		throw new Error("Conversation does not have a vector store associated, cannot add files")
	}
	public async getConversationVectorStoreFiles(_conversation: Conversation): Promise<GetVectorStoreFilesResult> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async getConversationVectorStoreFileContent(_conversation: Conversation, _fileId: string): Promise<GetConversationVectorStoreFileContentResult> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async deleteConversationVectorStoreFile(_conversation: Conversation, _fileId: string): Promise<void> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async getConversationMessages(conversation: Conversation): Promise<GetConversationMessagesResult> {
		return {
			messages: conversation.messages
		}
	}
}
