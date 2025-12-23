import { writeFileSync } from "node:fs"
import type { ResponseCreateParamsBase, ResponseInput, ResponseInputContent, ResponseInputItem, ResponseStreamEvent, Tool } from "openai/resources/responses/responses"
import type { Stream } from "openai/streaming"
import { createSse } from "$lib/streaming.js"
import type { AgentConfig, DBAgent, IAgent, IAgentResults } from "$lib/types/agents"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt } from "$lib/types/message"
import { wrapTextInPdf } from "$lib/util/pdf-util"
import { updateDBConversation } from "../agents/conversations"
import { OpenAIVendor, openai } from "./openai"
import { createMessageFromOpenAIMessage } from "./openai-message"
import { OPEN_AI_SUPPORTED_MESSAGE_FILE_MIME_TYPES, OPEN_AI_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES, OPEN_AI_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES } from "./openai-supported-filetypes"
import { uploadFilesToOpenAIVectorStore } from "./vector-store"

const openAIVendor = new OpenAIVendor()
const vendorInfo = openAIVendor.getVendorInfo()

export const handleOpenAIStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
	return new ReadableStream({
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
}

type OpenAIResponseConfigResult = {
	requestConfig: ResponseCreateParamsBase
}

const createOpenAIPromptFromAgentPrompt = async (initialPrompt: AgentPrompt): Promise<string | ResponseInput> => {
	if (typeof initialPrompt === "string") {
		return initialPrompt
	}

	return await Promise.all(
		initialPrompt.map(async (item) => {
			const content = await Promise.all(
				item.input.map(async (inputPart) => {
					switch (inputPart.type) {
						case "text":
							return { type: "input_text", text: inputPart.text } as ResponseInputContent
						case "image":
							return { type: "input_image", image_url: inputPart.imageUrl } as ResponseInputContent
						case "file": {
							if (inputPart.fileUrl.startsWith("data:text/plain;base64") || inputPart.fileUrl.startsWith("data:text/csv;base64") || inputPart.fileUrl.startsWith("data:application/json;base64")) {
								const pdfBytes = await wrapTextInPdf(inputPart.fileUrl)
								return { type: "input_file", file_data: pdfBytes, filename: inputPart.fileName } as ResponseInputContent
							}

							return { type: "input_file", file_data: inputPart.fileUrl, filename: inputPart.fileName } as ResponseInputContent
						}
						default:
							throw new Error(`Unsupported input type in advanced prompt for OpenAI...`)
					}
				})
			)

			const inputItem: ResponseInputItem = {
				role: item.role === "agent" ? "assistant" : item.role,
				type: "message",
				content: content
			}

			return inputItem
		})
	)
}

const createOpenAIResponseConfig = async (agentConfig: AgentConfig, openAIConversationId: string, inputPrompt: AgentPrompt, userVectorStoreId: string | null): Promise<OpenAIResponseConfigResult> => {
	if (agentConfig.type !== "manual" && agentConfig.type !== "predefined") {
		throw new Error("Invalid agent config type for OpenAI response configuration")
	}
	if (agentConfig.type === "predefined") {
		return {
			requestConfig: {
				input: await createOpenAIPromptFromAgentPrompt(inputPrompt),
				prompt: {
					id: agentConfig.vendorAgent.id
				},
				conversation: openAIConversationId
			}
		}
	}
	// SJekk om modellen er lov, hvis ikke default til en som er lov på det RIKTIGE stedet
	const openAIResponseConfig: ResponseCreateParamsBase = {
		model: vendorInfo.models.supported.includes(agentConfig.model) ? agentConfig.model : vendorInfo.models.default,
		conversation: openAIConversationId,
		input: await createOpenAIPromptFromAgentPrompt(inputPrompt),
		instructions: agentConfig.instructions.join(". ")
	}
	const fileSearchTool: Tool = {
		type: "file_search",
		vector_store_ids: []
	}
	// If we have userVectorStoreId and allowed, add it to tools
	if (agentConfig.vectorStoreEnabled && userVectorStoreId) {
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

	public getAgentInfo(): IAgentResults["GetAgentInfoResult"] {
		// In the future, we might want to change types based on model as well.
		return {
			...this.dbAgent,
			allowedMimeTypes: {
				messageFiles: this.dbAgent.config.messageFilesEnabled ? OPEN_AI_SUPPORTED_MESSAGE_FILE_MIME_TYPES : [],
				messageImages: this.dbAgent.config.messageFilesEnabled ? OPEN_AI_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES : [],
				vectorStoreFiles: this.dbAgent.config.vectorStoreEnabled ? OPEN_AI_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES : []
			}
		}
	}
	public async createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
		const openAIConversation = await openai.conversations.create({ metadata: { agent: this.dbAgent.name } })

		const { requestConfig } = await createOpenAIResponseConfig(this.dbAgent.config, openAIConversation.id, initialPrompt, null)
		if (streamResponse) {
			const responseStream = await openai.responses.create({ ...requestConfig, stream: true })
			return {
				vendorConversationId: openAIConversation.id,
				vectorStoreId: null,
				response: handleOpenAIStream(responseStream, conversation._id)
			}
		}
		throw new Error("Non-streaming create conversation not implemented yet")
	}

	public async appendMessageToConversation(conversation: DBConversation, prompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["AppendToConversationResult"]> {
		const { requestConfig } = await createOpenAIResponseConfig(this.dbAgent.config, conversation.vendorConversationId, prompt, conversation.vectorStoreId || null)
		if (streamResponse) {
			const responseStream = await openai.responses.create({ ...requestConfig, stream: true })
			return {
				response: handleOpenAIStream(responseStream)
			}
		}
		throw new Error("Non-streaming append message not implemented yet")
	}

	appendVectorStoreFiles(_files: File[], _streamResponse: boolean): Promise<IAgentResults["AddVectorStoreFilesResult"]> {
		throw new Error("Method not implemented.")
	}

	public async addConversationVectorStoreFiles(conversation: DBConversation, files: File[], streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		let vectorStoreId = conversation.vectorStoreId
		if (!vectorStoreId) {
			const newVectorStore = await openAIVendor.addVectorStore(`Conversation ${conversation._id} Vector Store`, `Vector store for conversation ${conversation._id}`)
			updateDBConversation(conversation._id, { vectorStoreId: newVectorStore.id })
			vectorStoreId = newVectorStore.id // obs obs, det er en referanse, så oppdaterer faktisk conversation objektet også
		}
		if (streamResponse) {
			return await uploadFilesToOpenAIVectorStore(vectorStoreId, files, streamResponse)
		}
		throw new Error("Non-streaming add conversation files not implemented yet")
	}
	public async getConversationVectorStoreFiles(conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]> {
		// Hent filer fra OpenAI vector store her
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot get files")
		}
		return await openAIVendor.getVectorStoreFiles(conversation.vectorStoreId)
	}

	public async getConversationVectorStoreFileContent(conversation: DBConversation, _fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]> {
		// Hent filinnhold fra OpenAI her
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot get file content")
		}
		throw new Error("Get conversation vector store file content is not supported by OpenAI API. Gotta solve this differently.")
	}

	public async deleteConversationVectorStoreFile(conversation: DBConversation, fileId: string): Promise<void> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation has no vector store associated, cannot delete file")
		}
		if (!fileId) {
			throw new Error("File ID is required to delete file from vector store")
		}
		await openAIVendor.deleteVectorStoreFile(conversation.vectorStoreId, fileId)
	}

	public async getConversationMessages(conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]> {
		const conversationItems = await openai.conversations.items.list(conversation.vendorConversationId, { limit: 50, order: "desc" })

		// Tmp write to file for inspection
		writeFileSync(`./ignore/openai-conversation-items.json`, JSON.stringify(conversationItems.data, null, 2))
		// Vi tar først bare de som er message, og mapper de om til Message type vårt system bruker
		const messages = conversationItems.data.map((item) => createMessageFromOpenAIMessage(item))
		return { messages: messages.reverse() } // Vi vil ha ascending order på de nyeste
	}
}
