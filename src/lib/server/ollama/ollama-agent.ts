import type { AbortableAsyncIterator, ChatResponse } from "ollama"
import { createSse } from "$lib/streaming.js"
import type { AgentConfig, DBAgent, IAgent, IAgentResults } from "$lib/types/agents"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt, Message } from "$lib/types/message"
import { OllamaVendor, ollama } from "./ollama"

type OllamaResponse = ChatResponse | AbortableAsyncIterator<ChatResponse>

export type OllamaCreateResponse = {
	ollamaConversationId: string
	response: OllamaResponse
	messages: Message[]
}

const ollamaVendor = new OllamaVendor()
const vendorInfo = ollamaVendor.getVendorInfo()

export const handleOllamaStream = (conversation: DBConversation, stream: AbortableAsyncIterator<ChatResponse>): ReadableStream => {
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

			addMessage(message, conversation.messages, "agent", "text")
			controller.close()
		}
	})
	return readableStream
}

type OllamaMessage = {
	role: string
	content: string
}

const addMessage = (prompt: AgentPrompt, messages: Message[], originator: "user" | "agent" | "system", contentType: "text") => {
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
		content: [
			{
				text: prompt,
				type: contentType
			}
		]
	}
	messages.push(msg)
}

const makeOllamaInstance = async (ollamaResponseConfig: AgentConfig, messages: OllamaMessage[], streamResponse: boolean): Promise<OllamaResponse> => {
	/*
   Dette er snedig, istedenfor multiple response verdier har de haller laget hardkodede versjoner av 
   chat for stream er enten true eller false, men det er ikke en boolean
  */
	if (ollamaResponseConfig.type === "predefined") {
		throw new Error("Predefined Ollama agents are not supported")
	}

	const response = streamResponse
		? await ollama.chat({
				model: vendorInfo.models.supported.includes(ollamaResponseConfig.model) ? ollamaResponseConfig.model : vendorInfo.models.default,
				messages: messages,
				stream: true
			})
		: await ollama.chat({
				model: vendorInfo.models.supported.includes(ollamaResponseConfig.model) ? ollamaResponseConfig.model : vendorInfo.models.default,
				messages: messages,
				stream: false
			})

	return response
}

const convertToOllamaMessages = (messages: Message[]): OllamaMessage[] => {
	return messages.map((value: Message) => {
		return {
			role: value.role === "agent" ? "assistant" : value.role,
			content: value.content
				.filter((contentPart) => contentPart.type === "text")
				.map((contentPart) => contentPart.text)
				.join(" ")
		}
	})
}

export class OllamaAgent implements IAgent {
	constructor(private dbAgent: DBAgent) {}

	public getAgentInfo(): IAgentResults["GetAgentInfoResult"] {
		throw new Error("Method not implemented in OllamaAgent")
	}

	public async createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		const instructions = this.dbAgent.config.instructions.join("\n")
		addMessage(instructions, conversation.messages, "system", "text")
		addMessage(initialPrompt, conversation.messages, "user", "text")
		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config, convertToOllamaMessages(conversation.messages), streamResponse)
		if (streamResponse) {
			return {
				vendorConversationId: crypto.randomUUID(),
				vectorStoreId: null,
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}

	public async appendMessageToConversation(conversation: DBConversation, prompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["AppendToConversationResult"]> {
		addMessage(prompt, conversation.messages, "user", "text")
		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config, convertToOllamaMessages(conversation.messages), streamResponse)
		if (streamResponse) {
			return {
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}
	public async addConversationVectorStoreFiles(_conversation: DBConversation, _files: File[], _streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		throw new Error("Conversation does not have a vector store associated, cannot add files")
	}
	public async getConversationVectorStoreFiles(_conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async getConversationVectorStoreFileContent(_conversation: DBConversation, _fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]> {
		throw new Error("Method not implemented in MockAIAgent")
	}
	public async deleteConversationVectorStoreFile(_conversation: DBConversation, _fileId: string): Promise<void> {
		throw new Error("Method not implemented in MockAIAgent")
	}

	public async getConversationMessages(conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]> {
		return {
			messages: conversation.messages
		}
	}
}
