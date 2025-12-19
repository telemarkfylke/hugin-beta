import type { AbortableAsyncIterator, ChatRequest, ChatResponse, EmbedRequest } from "ollama"
import { createSse } from "$lib/streaming.js"
import type { AgentConfig, DBAgent, IAgent, IAgentResults } from "$lib/types/agents"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt, Message } from "$lib/types/message"
import { OllamaVendor, ollama } from "./ollama"
import { OLLAMA_SUPPORTED_MESSAGE_FILE_MIME_TYPES, OLLAMA_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES, OLLAMA_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES } from "./ollama-supported-filetypes"
import { env } from "$env/dynamic/private"
import type { VectorChunk } from "$lib/types/vector"
import { cosineSimilarity, filesToChunks, filterChunks, filterChunksHigest, splitToChuncks } from "$lib/util/vectorUtil"
import { MockVectorStore } from "../db/vectorstore/mock_vectorstore"
import type { IVectorStore } from "../db/vectorstore/interface"
import { MongoDbVectorStore } from "../db/vectorstore/mongodb_vectorstore"

let mockDbData: { agents: DBAgent[]; conversations: DBConversation[]; vectors: Record<string, VectorChunk[]> }
if (env.MOCK_DB === "true") {
	const { getMockDb } = await import("$lib/server/db/mockdb.js")
	mockDbData = await getMockDb()
}

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
		reply.push({ role: 'system', content: instructions.join("\n") })
	}
	if (instructions && instructions.length > 0) {
		reply.push({ role: 'system', content: context.join("\n") })
	}
	reply.push(...messages.map((value: Message) => {
		return {
			role: value.role === "agent" ? "assistant" : value.role,
			content: value.content
				.filter((contentPart) => contentPart.type === "text")
				.map((contentPart) => contentPart.text)
				.join(" ")
		}
	}))
	return reply;
}

const findRelevantVectors = async (vectorContexts: string[], prompt: string): Promise<string[]> => {
	const vectorStore: IVectorStore = await getVectorStore()
	const vectorChunks = await vectorStore.getVectorChunks(vectorContexts)
	if (!vectorChunks || vectorChunks.length === 0)	return []

	const req: EmbedRequest = {
		model: 'embeddinggemma',
		input: prompt.toLowerCase(),
		truncate: false
	}
	const res = await ollama.embed(req)
	const promptVector = res.embeddings[0] || [];

	return filterChunksHigest(promptVector, vectorChunks)
}

const getVectorStore = async (): Promise<IVectorStore> => {
	if (env.MOCK_DB) {
		return new MockVectorStore()
	}

	return new MongoDbVectorStore()
}

export class OllamaAgent implements IAgent {
	constructor(private dbAgent: DBAgent) { }

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

		throw new Error("Method not implemented in OllamaAgent")
	}

	public async createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		//const instructions = this.dbAgent.config.instructions.join("\n")
		//addMessage(instructions, conversation.messages, "system", "text")

		addMessage(initialPrompt, conversation.messages, "user", "text")
		const vectorContexts = [`${this.dbAgent._id}:${conversation._id}`,`${this.dbAgent._id}:context` ]
		const vectors = (typeof initialPrompt === "string") ? await findRelevantVectors(vectorContexts, initialPrompt) : []

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
		const vectorContexts = [`${this.dbAgent._id}:${conversation._id}`,`${this.dbAgent._id}:context` ]
		const vectors = (typeof prompt === "string") ? await findRelevantVectors(vectorContexts, prompt) : []

		const ollamaResponse = await makeOllamaInstance(this.dbAgent.config, convertToOllamaMessages(conversation.messages, this.dbAgent.config.instructions, vectors), streamResponse)
		if (streamResponse) {
			return {
				response: handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>)
			}
		}
		throw new Error("Non-streaming Ollama conversation creation is not yet implemented")
	}

	public async appendVectorStoreFiles(files: File[], _streamResponse: boolean): Promise<IAgentResults["AddVectorStoreFilesResult"]> {
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		const vectorStrings: string[] = await filesToChunks(files)
		const req: EmbedRequest = {
			model: 'embeddinggemma',
			input: vectorStrings,
			truncate: false
		}

		const vectorStore: IVectorStore = await getVectorStore()
		const vectorContext = `${this.dbAgent._id}:context`
		const res = await ollama.embed(req)
		vectorStore.addVectorData(vectorContext, vectorStrings, res.embeddings)

		const readableStream = new ReadableStream({
			async start(controller) {
				for (const file of files) {
					controller.enqueue(createSse({ event: "agent.vectorstore.file.processed", data: { fileId: crypto.randomUUID(), fileName: file.name } }))
				}
			}
		}
		)

		return { response: readableStream }
	}

	public async addConversationVectorStoreFiles(conversation: DBConversation, files: File[], _streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		if (this.dbAgent.config.type === "predefined") {
			throw new Error("Predefined Ollama agents are not supported")
		}

		const vectorStrings: string[] = await filesToChunks(files)
		const req: EmbedRequest = {
			model: 'embeddinggemma', //vendorInfo.models.supported.includes(this.dbAgent.config.model) ? this.dbAgent.config.model : vendorInfo.models.default,
			input: vectorStrings,
			truncate: false
		}

		const vectorStore: IVectorStore = await getVectorStore()
		const vectorContext = `${this.dbAgent._id}:${conversation._id}`
		const res = await ollama.embed(req)
		vectorStore.addVectorData(vectorContext, vectorStrings, res.embeddings)

		const readableStream = new ReadableStream({
			async start(controller) {
				for (const file of files) {
					controller.enqueue(createSse({ event: "conversation.vectorstore.files.processed", data: { vectorStoreId: vectorContext, files: [{ fileId: crypto.randomUUID()}] }}))
				}
			}
		}
		)

		return { response: readableStream }
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
