import OpenAI from "openai"
import type { ResponseCreateParamsBase, ResponseInput, ResponseInputContent, ResponseInputItem, ResponseStreamEvent, Tool } from "openai/resources/responses/responses"
import type { Stream } from "openai/streaming"
import { env } from "$env/dynamic/private"
import { createSse } from "$lib/streaming.js"
import type { AddConversationFilesResult, AgentConfig, AppendToConversationResult, Conversation, CreateConversationResult, DBAgent, GetConversationMessagesResult, GetConversationVectorStoreFileContentResult, IAgent, Message } from "$lib/types/agents"
import { updateConversation } from "../agents/conversations"
import { createOpenAIVectorStore, getOpenAIVectorStoreFiles, uploadFilesToOpenAIVectorStore } from "./vector-store"
import type { AgentPrompt, GetVectorStoreFilesResult, VectorStoreFile } from "$lib/types/requests"

export const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY || "bare-en-tulle-key"
})

export const handleOpenAIStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
	const readableStream = new ReadableStream({
		async start(controller) {
			if (conversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId } }))
			}
			for await (const chunk of stream) {
				switch (chunk.type) {
					case "response.created":
						// controller.enqueue(createSse('conversation.started', { openAIConversationId: chunk.response.conversation?.id }));
						break
					case "response.output_text.delta":
						controller.enqueue(createSse({ event: "conversation.message.delta", data: { messageId: chunk.item_id, content: chunk.delta } }))
						break
					case "response.completed":
						controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.response.usage?.total_tokens || 0 } }))
						break
					case "response.failed":
						controller.enqueue(createSse({ event: "error", data: { message: chunk.response.error?.message || "Unknown error" } }))
						break
					default:
						console.warn("Unhandled OpenAI stream event type:", chunk.type)
						break
					// Ta hensyn til flere event typer her etter behov
				}
			}
			controller.close()
		}
	})
	return readableStream
}

type OpenAIResponseConfigResult = {
	requestConfig: ResponseCreateParamsBase
}

/*
const createMistralPromptFromAgentPrompt = (initialPrompt: AgentPrompt): ConversationInputs => {
	if (typeof initialPrompt === "string") {
		return initialPrompt
	}
	return initialPrompt.map((item) => {
		if (item.role !== "user" && item.role !== "agent") {
			throw new Error(`Unsupported role in advanced prompt for Mistral: ${item.role}`)
		}
		const inputEntry: InputEntries = {
			role: item.role === "user" ? "user" : "assistant",
			type: "message.input",
			content: item.input.map((inputItem) => {
				switch (inputItem.type) {
					case "text":
						return { type: "text", text: inputItem.text }
					case "image":
						return { type: "image_url", imageUrl: inputItem.imageUrl }
					case "file":
						return { type: "document_url", documentUrl: inputItem.fileUrl, documentName: inputItem.fileName }
					default:
						throw new Error(`Unsupported input type in advanced prompt for Mistral...`)
				}
			})
		}
		return inputEntry
	})
}
*/

const createOpenAIPromptFromAgentPrompt = (initialPrompt: AgentPrompt): string | ResponseInput => {
	if (typeof initialPrompt === "string") {
		return initialPrompt
	}
	
	return initialPrompt.map((item) => {
		const inputItem: ResponseInputItem = {
			role: item.role === "agent" ? "assistant" : item.role,
			type: 'message',
			content: item.input.map((inputPart) => {
				switch (inputPart.type) {
					case "text":
						return { type: 'input_text', text: inputPart.text } as ResponseInputContent
					case "image":
						return { type: 'input_image', image_url: inputPart.imageUrl } as ResponseInputContent
					case "file": {
						return { type: 'input_file', file_data: inputPart.fileUrl, filename: inputPart.fileName } as ResponseInputContent
					}
					default:
						throw new Error(`Unsupported input type in advanced prompt for OpenAI...`)
				}
			})
		}
		return inputItem
	})
}

const createOpenAIResponseConfig = (agentConfig: AgentConfig, openAIConversationId: string, inputPrompt: AgentPrompt, userVectorStoreId: string | null): OpenAIResponseConfigResult => {
	if (agentConfig.type !== "openai-response" && agentConfig.type !== "openai-prompt") {
		throw new Error("Invalid agent config type for OpenAI response configuration")
	}
	if (agentConfig.type === "openai-prompt") {
		return {
			requestConfig: {
				input: createOpenAIPromptFromAgentPrompt(inputPrompt),
				prompt: {
					id: agentConfig.prompt.id
				},
				conversation: openAIConversationId
			}
		}
	}
	// Now we know it's type 'openai-response'
	const openAIResponseConfig: ResponseCreateParamsBase = {
		model: agentConfig.model,
		conversation: openAIConversationId,
		input: createOpenAIPromptFromAgentPrompt(inputPrompt),
		instructions: agentConfig.instructions || null
	}
	const fileSearchTool: Tool = {
		type: "file_search",
		vector_store_ids: []
	}
	// If we have userVectorStoreId and allowed, add it to tools
	if (agentConfig.fileSearchEnabled && userVectorStoreId) {
		fileSearchTool.vector_store_ids.push(userVectorStoreId)
	}
	// If we have preconfigured vectorStoreIds in agentConfig, add them too
	if (agentConfig.vectorStoreIds && agentConfig.vectorStoreIds.length > 0) {
		fileSearchTool.vector_store_ids.push(...agentConfig.vectorStoreIds)
	}
	// Add tool only if we have vector store ids
	if (fileSearchTool.vector_store_ids.length > 0) {
		openAIResponseConfig.tools = [fileSearchTool]
	}
	return {
		requestConfig: openAIResponseConfig
	}
}

export class OpenAIAgent implements IAgent {
	constructor(private dbAgent: DBAgent) {}
	public async createConversation(conversation: Conversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<CreateConversationResult> {
		const openAIConversation = await openai.conversations.create({ metadata: { agent: this.dbAgent.name } })

		const { requestConfig } = createOpenAIResponseConfig(this.dbAgent.config, openAIConversation.id, initialPrompt, null)
		if (streamResponse) {
			const responseStream = await openai.responses.create({ ...requestConfig, stream: true })
			return {
				relatedConversationId: openAIConversation.id,
				vectorStoreId: null,
				response: handleOpenAIStream(responseStream, conversation._id)
			}
		}
		throw new Error("Non-streaming create conversation not implemented yet")
	}

	public async appendMessageToConversation(conversation: Conversation, prompt: AgentPrompt, streamResponse: boolean): Promise<AppendToConversationResult> {
		const { requestConfig } = createOpenAIResponseConfig(this.dbAgent.config, conversation.relatedConversationId, prompt, conversation.vectorStoreId || null)
		if (streamResponse) {
			const responseStream = await openai.responses.create({ ...requestConfig, stream: true })
			return {
				response: handleOpenAIStream(responseStream)
			}
		}
		throw new Error("Non-streaming append message not implemented yet")
	}

	public async addConversationVectorStoreFiles(conversation: Conversation, files: File[], streamResponse: boolean): Promise<AddConversationFilesResult> {
		let vectorStoreId = conversation.vectorStoreId
		if (!vectorStoreId) {
			const newVectorStoreId = await createOpenAIVectorStore(conversation._id)
			updateConversation(conversation._id, { vectorStoreId: newVectorStoreId })
			vectorStoreId = newVectorStoreId // obs obs, det er en referanse, så oppdaterer faktisk conversation objektet også
		}
		if (streamResponse) {
			return await uploadFilesToOpenAIVectorStore(conversation._id, vectorStoreId, files, streamResponse)
		}
		throw new Error("Non-streaming add conversation files not implemented yet")
	}
	public async getConversationVectorStoreFiles(conversation: Conversation): Promise<GetVectorStoreFilesResult> {
		// Hent filer fra OpenAI vector store her
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot get files")
		}
		const filesList = await getOpenAIVectorStoreFiles(conversation.vectorStoreId)
		const files: VectorStoreFile[] = filesList.map(file => {
			return {
				id: file.id,
				name: file.filename,
				type: 'open-ai-drittfil', // todo, finn mimeType eller noe
				bytes: file.bytes,
				summary: null, // OpenAI gir ikke summary per nå
				status: file.status === 'completed' ? 'ready' : file.status === 'failed' ? 'error' : 'processing' // Obs, Jørgen er lat, men det går sikkert bra
			}
		})
		return { files }
	}

	public async getConversationVectorStoreFileContent(conversation: Conversation, _fileId: string): Promise<GetConversationVectorStoreFileContentResult> {
		// Hent filinnhold fra OpenAI her
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot get file content")
		}
		throw new Error("Get conversation vector store file content is not supported by OpenAI API. Gotta solve this differently.")
	}

	public async deleteConversationVectorStoreFile(conversation: Conversation, fileId: string): Promise<void> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot delete file")
		}
		// First delete from vector store - OpenAI says that deleting the file will also remove it from vector store, but that is not the case (https://platform.openai.com/docs/api-reference/files/delete)
		const deleteFromVectorStore = await openai.vectorStores.files.delete(fileId, { vector_store_id: conversation.vectorStoreId })
		console.log("Delete from vector store response:", deleteFromVectorStore)
		if (!deleteFromVectorStore.deleted) {
			throw new Error(`Failed to delete file ${fileId} from OpenAI vector store ${conversation.vectorStoreId}`)
		}
		const deleteFileResponse = await openai.files.delete(fileId)
		console.log("Delete file response:", deleteFileResponse)
		if (!deleteFileResponse.deleted) {
			throw new Error(`Failed to delete file ${fileId} from OpenAI files`)
		}
	}

	public async getConversationMessages(conversation: Conversation): Promise<{ messages: Message[] }> {
		const conversationItems = await openai.conversations.items.list(conversation.relatedConversationId, { limit: 50, order: "desc" })
		// Vi tar først bare de som er message, og mapper de om til Message type vårt system bruker
		const messages = conversationItems.data
			.filter((item) => item.type === "message")
			.map((item) => {
				// Obs, kommer nok noe citations og greier etterhvert

				const newMessage: Message = {
					id: item.id || "what",
					role: item.role === "assistant" ? "agent" : "user", // TODO - her kan dukke opp flere roller akkurat nå altså...
					type: item.type,
					status: item.status,
					content: {
						type: item.role === "user" ? "inputText" : "outputText",
						text:
							item.role === "user"
								? item.content.find((con) => con.type === "input_text")?.text || "ukjent input drit"
								: item.content.find((con) => con.type === "output_text")?.text || "ukjent output drit"
					}
				}
				return newMessage
			})
		return { messages: messages.reverse() } // Vi vil ha ascending order på de nyeste
	}
}
