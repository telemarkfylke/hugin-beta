import type { AbortableAsyncIterator, ChatResponse } from "ollama"
import { fileToChunks } from "$lib/server/db/vectorstore/vectorUtil"
import { createSse } from "$lib/streaming.js"
import type { AgentConfig, DBAgent, IAgent, IAgentResults } from "$lib/types/agents"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt, Message } from "$lib/types/message"
import type { VectorStoreFile } from "$lib/types/vector-store"
import { combineVectorStores } from "../agents/agents"
import { updateDBConversation } from "../agents/conversations"
import type { IVectorStoreDb } from "../db/vectorstore/interface"
import type { IEmbedder } from "../embeddings/interface"
import { getIocContainer } from "../ioc/container"
import { OllamaVendor, ollama } from "./ollama"
import { OLLAMA_SUPPORTED_MESSAGE_FILE_MIME_TYPES, OLLAMA_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES, OLLAMA_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES } from "./ollama-supported-filetypes"

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

const convertToOllamaMessages = (messages: Message[], instructions: string[], context: string[]): OllamaMessage[] => {
	const reply: OllamaMessage[] = []
	if (instructions && instructions.length > 0) {
		reply.push({ role: "system", content: instructions.join("\n") })
	}
	if (instructions && instructions.length > 0) {
		reply.push({ role: "system", content: context.join("\n") })
	}
	reply.push(
		...messages.map((value: Message) => {
			return {
				role: value.role === "agent" ? "assistant" : value.role,
				content: value.content
					.filter((contentPart) => contentPart.type === "text")
					.map((contentPart) => contentPart.text)
					.join(" ")
			}
		})
	)
	return reply
}

export class OllamaAgent implements IAgent {
	private embedder: IEmbedder
	private vectorStore: IVectorStoreDb

	constructor(
		private dbAgent: DBAgent,
		embedder?: IEmbedder | null,
		vectorStore?: IVectorStoreDb | null
	) {
		const iocContainer = getIocContainer()
		this.embedder = embedder || iocContainer.embedder
		this.vectorStore = vectorStore || iocContainer.vectorStore
	}

	public getAgentInfo(): IAgentResults["GetAgentInfoResult"] {
		// In the future, we might want to change types based on model as well.
		return {
			...this.dbAgent,
			allowedMimeTypes: {
				messageFiles: this.dbAgent.config.messageFilesEnabled ? OLLAMA_SUPPORTED_MESSAGE_FILE_MIME_TYPES : [],
				messageImages: this.dbAgent.config.messageFilesEnabled ? OLLAMA_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES : [],
				vectorStoreFiles: this.dbAgent.config.vectorStoreEnabled ? OLLAMA_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES : []
			}
		}
	}

	public async createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		addMessage(initialPrompt, conversation.messages, "user", "text")
		const vectorContexts: string[] = combineVectorStores(this.dbAgent.config, conversation)
		const vectors = typeof initialPrompt === "string" ? await this.findRelevantVectors(vectorContexts, initialPrompt) : []

		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config, convertToOllamaMessages(conversation.messages, this.dbAgent.config.instructions, vectors), streamResponse)
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
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		addMessage(prompt, conversation.messages, "user", "text")
		const vectorContexts: string[] = combineVectorStores(this.dbAgent.config, conversation)
		const vectors = typeof prompt === "string" ? await this.findRelevantVectors(vectorContexts, prompt) : []

		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config, convertToOllamaMessages(conversation.messages, this.dbAgent.config.instructions, vectors), streamResponse)
		if (streamResponse) {
			return {
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}

	public async addConversationVectorStoreFiles(conversation: DBConversation, files: File[], _streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		let contextId = conversation.vectorStoreId
		if (!contextId) {
			const newVectorStore = await ollamaVendor.addVectorStore(`Conversation ${conversation._id} Vector Store`, `Vector store for conversation ${conversation._id}`)
			contextId = newVectorStore.id
			updateDBConversation(conversation._id, { vectorStoreId: contextId })
		}

		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		const { embedder, vectorStore } = this
		const resultFiles: VectorStoreFile[] = []
		const readableStream = new ReadableStream({
			async start(controller) {
				for (const file of files) {
					const vectorStrings: string[] = await fileToChunks(file)
					const embeddings = await embedder.embedMultiple(vectorStrings)
					const vectorFile = await vectorStore.makeFile(contextId, file.name, file.size)
					resultFiles.push(vectorFile)
					controller.enqueue(createSse({ event: "conversation.vectorstore.file.uploaded", data: { fileId: vectorFile.id, fileName: vectorFile.name } }))
					vectorStore.addVectorData(contextId, vectorFile.id, vectorStrings, embeddings)
					controller.enqueue(createSse({ event: "conversation.vectorstore.files.processed", data: { vectorStoreId: contextId, files: [{ fileId: vectorFile.id }] } }))
				}
			}
		})
		return { response: readableStream }
	}

	public async getConversationVectorStoreFiles(_conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]> {
		throw new Error("Method not implemented in OllamaAgent")
	}
	public async getConversationVectorStoreFileContent(_conversation: DBConversation, _fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]> {
		throw new Error("Method not implemented in OllamaAgent")
	}
	public async deleteConversationVectorStoreFile(_conversation: DBConversation, _fileId: string): Promise<void> {
		throw new Error("Method not implemented in OllamaAgent")
	}
	public async getConversationMessages(conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]> {
		return {
			messages: conversation.messages
		}
	}

	private async findRelevantVectors(vectorContexts: string[], prompt: string): Promise<string[]> {
		const promptVector = await this.embedder.embedSingle(prompt.toLowerCase())
		const result = await this.vectorStore.search(vectorContexts, promptVector)
		return result
	}
}
