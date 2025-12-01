import { writeFileSync } from "node:fs"
import { Mistral } from "@mistralai/mistralai"
import type { EventStream } from "@mistralai/mistralai/lib/event-streams"
import type { ConversationInputs, ConversationRequest, DocumentLibraryTool, InputEntries, MessageInputEntry, MessageOutputEntry } from "@mistralai/mistralai/models/components"
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents"
import { env } from "$env/dynamic/private"
import { createSse } from "$lib/streaming.js"
import type {
	AddConversationFilesResult,
	Agent,
	AgentConfig,
	AppendToConversationResult,
	Conversation,
	CreateConversationResult,
	DBAgent,
	GetConversationMessagesResult,
	GetConversationVectorStoreFileContentResult,
	IAgent,
	Message
} from "$lib/types/agents.js"
import type { AgentPrompt, GetVectorStoreFilesResult, VectorStoreFile } from "$lib/types/requests"
import { getDocumentsInMistralLibrary, uploadFilesToMistralLibrary } from "./document-library"
import { MISTRAL_SUPPORTED_MESSAGE_FILE_MIME_TYPES, MISTRAL_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES, MISTRAL_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES } from "./mistral-supported-filetypes"

export const mistral = new Mistral({
	apiKey: env.MISTRAL_API_KEY || "bare-en-tulle-key"
})

const handleMistralStream = (stream: EventStream<ConversationEvents>, dbConversationId?: string, userLibraryId?: string | null): ReadableStream<Uint8Array> => {
	const readableStream: ReadableStream<Uint8Array> = new ReadableStream({
		async start(controller) {
			if (dbConversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId: dbConversationId } }))
			}
			if (userLibraryId) {
				controller.enqueue(createSse({ event: "conversation.vectorstore.created", data: { vectorStoreId: userLibraryId } }))
			}
			for await (const chunk of stream) {
				if (!["conversation.response.started", "message.output.delta"].includes(chunk.event)) {
					console.log("Mistral stream chunk event:", chunk.event, chunk.data)
				}
				// Types are not connected to the event in mistral... so we use type instead
				switch (chunk.data.type) {
					case "conversation.response.started":
						// controller.enqueue(createSse('conversation.started', { MistralConversationId: chunk.data.conversationId }));
						break
					case "message.output.delta":
						controller.enqueue(
							createSse({
								event: "conversation.message.delta",
								data: { messageId: chunk.data.id, content: typeof chunk.data.content === "string" ? chunk.data.content : "FIKK EN CHUNK SOM IKKE ER STRING, sjekk mistral-typen OutputContentChunks" }
							})
						)
						break
					case "conversation.response.done":
						controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.data.usage.totalTokens || 0 } }))
						break
					case "conversation.response.error":
						controller.enqueue(createSse({ event: "error", data: { message: chunk.data.message } }))
						break
					// Ta hensyn til flere event typer her etter behov
					default:
						console.warn("Unhandled Mistral stream event type:", chunk.data.type)
						console.log("Full chunk data:", chunk.data)
				}
			}
			controller.close()
		}
	})
	return readableStream
}

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

// TODO - gjør noe med det under om du trenger
type MistralConversationConfigResult = {
	requestConfig: ConversationRequest
	data: {
		userLibraryId: string | null
	}
}
const createMistralConversationConfig = async (agentConfig: AgentConfig, initialPrompt: AgentPrompt): Promise<MistralConversationConfigResult> => {
	if (agentConfig.type !== "mistral-conversation" && agentConfig.type !== "mistral-agent") {
		throw new Error(`Invalid agent config type for Mistral conversation: ${agentConfig.type}`)
	}

	// Map initialPrompt to Mistral ConversationInputs
	const mistralPrompt: ConversationInputs = createMistralPromptFromAgentPrompt(initialPrompt)

	// If simple agentId, use that and return
	if (agentConfig.type === "mistral-agent") {
		return {
			requestConfig: {
				agentId: agentConfig.agentId,
				inputs: mistralPrompt
			},
			data: {
				userLibraryId: null
			}
		}
	}
	// Now we know it's type mistral-conversation
	// If we fileSearchEnabled, we need to create a library for the user to upload files to

	const mistralConversationConfig: ConversationRequest = {
		model: agentConfig.model,
		inputs: mistralPrompt,
		instructions: agentConfig.instructions || ""
	}
	// Tool if needed
	const documentLibraryTool: DocumentLibraryTool & { type: "document_library" } = {
		type: "document_library",
		libraryIds: [] as string[]
	}

	// If file search is enabled, create a library for the user and add document_library tool
	let userLibraryId: string | null = null
	if (agentConfig.vectorStoreEnabled) {
		const userLibrary = await mistral.beta.libraries.create({
			name: `Library for conversation - add something useful here`,
			description: "Library created for conversation with document tools"
		})
		userLibraryId = userLibrary.id
		documentLibraryTool.libraryIds.push(userLibrary.id)
	}
	// If preconfigured document libraries, add them as well
	if (agentConfig.documentLibraryIds && agentConfig.documentLibraryIds.length > 0) {
		documentLibraryTool.libraryIds.push(...agentConfig.documentLibraryIds)
	}
	// Add documentLibraryTool only if we have library ids
	if (documentLibraryTool.libraryIds.length > 0) {
		mistralConversationConfig.tools = [documentLibraryTool]
	}
	// If web search is enabled, add web_search tool
	if (agentConfig.webSearchEnabled) {
		throw new Error("Web search tool is not yet implemented for Mistral agents")
	}
	return {
		requestConfig: mistralConversationConfig,
		data: {
			userLibraryId
		}
	}
}

export class MistralAgent implements IAgent {
	constructor(private dbAgent: DBAgent) {}

	public getAgentInfo(): Agent {
		// In the future, we might want to change types based on model as well.
		return {
			...this.dbAgent,
			allowedMimeTypes: {
				messageFiles: this.dbAgent.config.messageFilesEnabled ? MISTRAL_SUPPORTED_MESSAGE_FILE_MIME_TYPES : [],
				messageImages: this.dbAgent.config.messageFilesEnabled ? MISTRAL_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES : [],
				vectorStoreFiles: this.dbAgent.config.vectorStoreEnabled ? MISTRAL_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES : []
			}
		}
	}

	public async createConversation(conversation: Conversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<CreateConversationResult> {
		const mistralConversationConfig = await createMistralConversationConfig(this.dbAgent.config, initialPrompt)

		if (streamResponse) {
			const conversationStarter = await mistral.beta.conversations.startStream(mistralConversationConfig.requestConfig)
			// REMARK: Dirty hack to extract conversationId from stream - hopefully Mistral wont change this behaviour in a long long time...

			const [conversationStarterStream, actualStream] = conversationStarter.tee() // Haha, lets create a tee so we can read it multiple time (creates two duplicate readable streams)

			// Then we extract the conversationId from the first stream, and pass the actualStream back (if it works...)
			const reader = conversationStarterStream.getReader()
			while (true) {
				const { value, done } = await reader.read()
				if (value?.data.type === "conversation.response.started") {
					reader.cancel() // Vi trenger ikke lese mer her, vi har det vi trenger
					const readableStream = handleMistralStream(actualStream as EventStream<ConversationEvents>, conversation._id, mistralConversationConfig.data.userLibraryId)

					return { relatedConversationId: value.data.conversationId, vectorStoreId: mistralConversationConfig.data.userLibraryId, response: readableStream }
				}
				if (done) {
					break // Oh no, vi fant ikke conversation response started event, har ikke noe å gå for... throw error under her
				}
			}
			throw new Error("Did not receive conversation started event from mistral, the dirty hack failed")
		}

		throw new Error("Non-streaming Mistral conversation creation is not yet implemented")
	}

	public async appendMessageToConversation(conversation: Conversation, prompt: AgentPrompt, streamResponse: boolean): Promise<AppendToConversationResult> {
		if (streamResponse) {
			const stream = await mistral.beta.conversations.appendStream({
				conversationId: conversation.relatedConversationId,
				conversationAppendStreamRequest: {
					inputs: createMistralPromptFromAgentPrompt(prompt)
				}
			})
			const readableStream = handleMistralStream(stream)
			return { response: readableStream }
		}
		throw new Error("Non-streaming Mistral conversation append is not yet implemented")
	}

	public async addConversationVectorStoreFiles(conversation: Conversation, files: File[], streamResponse: boolean): Promise<AddConversationFilesResult> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot add files")
		}
		if (streamResponse) {
			const readableStream = await uploadFilesToMistralLibrary(conversation.vectorStoreId, files, true)
			return { response: readableStream }
		}
		throw new Error("Non-streaming Mistral conversation add files is not yet implemented")
	}

	public async getConversationVectorStoreFiles(conversation: Conversation): Promise<GetVectorStoreFilesResult> {
		// Må hente filene som ligger i vector store knyttet til samtalen, må kanskje ha en get file også, som henter fildataene
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot get files")
		}
		const vectorStoreFiles = await getDocumentsInMistralLibrary(conversation.vectorStoreId)
		// Map om til riktig type
		const files: VectorStoreFile[] = vectorStoreFiles.map((doc) => {
			return {
				id: doc.id,
				type: doc.mimeType,
				name: doc.name,
				bytes: doc.size,
				status: "ready", // TODO, sjekk hva de dumme statusene til Mistral er... og mappe de til våre egne
				summary: doc.summary || null,
				uploadedAt: doc.createdAt
			}
		})
		return { files }
	}

	public async getConversationVectorStoreFileContent(conversation: Conversation, fileId: string): Promise<GetConversationVectorStoreFileContentResult> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot get file content")
		}
		console.log(`Fetching content for document ${fileId} from Mistral library ${conversation.vectorStoreId}`)
		const documentSignedUrl = await mistral.beta.libraries.documents.getSignedUrl({
			libraryId: conversation.vectorStoreId,
			documentId: fileId
		})
		return { redirectUrl: documentSignedUrl }
	}

	public async deleteConversationVectorStoreFile(conversation: Conversation, fileId: string): Promise<void> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot delete files")
		}
		console.log(`Deleting document ${fileId} from Mistral library ${conversation.vectorStoreId}`)
		await mistral.beta.libraries.documents.delete({
			libraryId: conversation.vectorStoreId,
			documentId: fileId
		})
		console.log(`Deleted document ${fileId} from Mistral library ${conversation.vectorStoreId}`) // TODO - status på at en fil driver å sletter?
	}

	public async getConversationMessages(conversation: Conversation): Promise<GetConversationMessagesResult> {
		const conversationItems = await mistral.beta.conversations.getHistory({ conversationId: conversation.relatedConversationId }) // Får ascending order (tror jeg)

		// Write temp to file
		writeFileSync("./ignore/mistral-conversation-items.json", JSON.stringify(conversationItems, null, 2))
		// Vi tar først bare de som er message, og mapper de om til Message type vårt system bruker
		const messages = conversationItems.entries
			.filter((item) => item.type === "message.input" || item.type === "message.output")
			.map((item) => {
				// Obs, kommer nok noe andre typer etterhvert
				item = item as MessageInputEntry | MessageOutputEntry
				const newMessage: Message = {
					id: item.id || "what-ingen-mistral-id",
					type: "message",
					status: "completed",
					role: item.type === "message.input" && item.role === "user" ? "user" : "agent",
					content: {
						type: item.type === "message.input" ? "inputText" : "outputText",
						text: typeof item.content === "string" ? item.content : "FIKK EN CONTENT SOM IKKE ER STRING, sjekk mistral-typen OutputContent"
					}
				}
				return newMessage
			})
		return { messages }
	}
}
