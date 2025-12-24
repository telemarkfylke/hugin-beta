import { writeFileSync } from "node:fs"
import type { EventStream } from "@mistralai/mistralai/lib/event-streams"
import type { ConversationInputs, ConversationRequest, DocumentLibraryTool, InputEntries } from "@mistralai/mistralai/models/components"
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents"
import { createSse } from "$lib/streaming.js"
import type { AgentConfig, DBAgent, IAgent, IAgentResults } from "$lib/types/agents.js"
import type { DBConversation } from "$lib/types/conversation"
import type { AgentPrompt } from "$lib/types/message"
import { MistralVendor, mistral } from "./mistral"
import { createMessageFromMistralMessage } from "./mistral-message"
import { MISTRAL_SUPPORTED_MESSAGE_FILE_MIME_TYPES, MISTRAL_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES, MISTRAL_SUPPORTED_VECTOR_STORE_FILE_MIME_TYPES } from "./mistral-supported-filetypes"
import { mistralFunctionTools, executeMistralfunksjon } from "./mistral-functions" // Funksjonskallgreier

const mistralVendor = new MistralVendor()
const vendorInfo = mistralVendor.getVendorInfo()

const handleMistralStream = (stream: EventStream<ConversationEvents>, dbConversationId?: string, userLibraryId?: string | null, conversationId?: string): ReadableStream<Uint8Array> => {
	return new ReadableStream({
		async start(controller) {
			// Samler opp funksjonskall som kommer i chunks fra Mistral
			// Map med toolCallId som nøkkel, slik at vi kan bygge opp komplette funksjonskall fra flere chunks
			const pendingFunctionCalls = new Map<string, { name: string; arguments: string; toolCallId: string }>() // Buffer for navn og argumenter
			let mistralConversationId: string | undefined = conversationId

			if (dbConversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId: dbConversationId } }))
			}
			if (userLibraryId) {
				controller.enqueue(createSse({ event: "conversation.vectorstore.created", data: { vectorStoreId: userLibraryId } }))
			}
			for await (const chunk of stream) {
				if (!["conversation.response.started", "message.output.delta"].includes(chunk.event)) {
					console.log("Mistral stream chunk event:", chunk.event, "data:", chunk.data)
				}
				// Types are not connected to the event in mistral... so we use type instead
				switch (chunk.data.type) {
					case "conversation.response.started":
						// Capture the Mistral conversation ID for later use
						if (!mistralConversationId) {
							mistralConversationId = chunk.data.conversationId
						}
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
						// Når streamen er ferdig, kjør alle funksjonskall vi har samlet opp
						console.log(`Response done - kjører ${pendingFunctionCalls.size} funksjonskall`)

						if (pendingFunctionCalls.size > 0) {
							const functionResults: Array<{ toolCallId: string; result: string; type: "function.result" }> = []

							// Kjør alle funksjonskallene vi har bufret
							for (const funksjon of pendingFunctionCalls.values()) {
								try {
									console.log(`Kjører funksjon: ${funksjon.name} med argumenter:`, funksjon.arguments)

									// Parse argumentene (er nå komplette siden vi har mottatt alle chunks)
									const args = JSON.parse(funksjon.arguments || "{}")

									// Kjør funksjonen
									const result = await executeMistralfunksjon(funksjon.name, args)
									console.log("Funksjonsresultat:", result)

									// Send resultat til frontend
									controller.enqueue(
										createSse({
											event: "conversation.function.result",
											data: {
												functionName: funksjon.name,
												result: String(result)
											}
										})
									)

									// Samle resultat for å sende tilbake til Mistral
									functionResults.push({
										toolCallId: funksjon.toolCallId,
										result: String(result),
										type: "function.result"
									})
								} catch (error) {
									console.error(`Feil ved kjøring av funksjon ${funksjon.name}:`, error)
									controller.enqueue(
										createSse({
											event: "error",
											data: {
												message: `Funksjonsutføring feilet: ${error instanceof Error ? error.message : "Ukjent feil"}`
											}
										})
									)
								}
							}

							// Tøm bufret funksjoner
							pendingFunctionCalls.clear()

							// Send funksjonsresultatene tilbake til Mistral og få endelig svar
							if (functionResults.length > 0 && mistralConversationId) {
								console.log("Sender funksjonsresultater tilbake til Mistral:", functionResults)
								const followUpStream = await mistral.beta.conversations.appendStream({
									conversationId: mistralConversationId,
									conversationAppendStreamRequest: {
										inputs: functionResults
									}
								})

								// Stream Mistrals endelige svar (etter bruk av funksjonsresultatene)
								for await (const followUpChunk of followUpStream) {
									if (!["conversation.response.started", "message.output.delta"].includes(followUpChunk.event)) {
										console.log("Mistral follow-up stream chunk event:", followUpChunk.event, "data:", followUpChunk.data)
									}

									switch (followUpChunk.data.type) {
										case "message.output.delta":
											controller.enqueue(
												createSse({
													event: "conversation.message.delta",
													data: {
														messageId: followUpChunk.data.id,
														content: typeof followUpChunk.data.content === "string" ? followUpChunk.data.content : ""
													}
												})
											)
											break
										case "conversation.response.done":
											controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: followUpChunk.data.usage.totalTokens || 0 } }))
											break
										case "conversation.response.error":
											controller.enqueue(createSse({ event: "error", data: { message: followUpChunk.data.message } }))
											break
									}
								}
							} else {
								// Ingen funksjonsresultater eller mangler conversation ID
								controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.data.usage.totalTokens || 0 } }))
							}
						} else {
							// Ingen funksjonskall, avslutter meldingen normalt
							controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.data.usage.totalTokens || 0 } }))
						}
						break
					case "conversation.response.error":
						controller.enqueue(createSse({ event: "error", data: { message: chunk.data.message } }))
						break
					case "function.call.delta":
						// Håndter funksjonskall som kommer i chunks
						// Mistral sender funksjonskall i flere deler, så vi må samle de opp
						const toolCallId = chunk.data.toolCallId
						const existingCall = pendingFunctionCalls.get(toolCallId)

						if (existingCall) {
							// Legg til flere argumenter til eksisterende funksjonskall
							existingCall.arguments += chunk.data.arguments || ""
						} else {
							// Første chunk for dette funksjonskallet - opprett ny entry
							pendingFunctionCalls.set(toolCallId, {
								name: chunk.data.name,
								arguments: chunk.data.arguments || "",
								toolCallId: toolCallId
							})
							console.log(`Funksjonskall startet: ${chunk.data.name}`)

							// Varsle frontend om at funksjon blir kalt
							controller.enqueue(
								createSse({
									event: "conversation.function.calling",
									data: {
										functionName: chunk.data.name,
										arguments: ""
									}
								})
							)
						}
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
	if (agentConfig.type !== "predefined" && agentConfig.type !== "manual") {
		throw new Error(`Invalid agent config type for Mistral conversation`)
	}

	// Map initialPrompt to Mistral ConversationInputs
	const mistralPrompt: ConversationInputs = createMistralPromptFromAgentPrompt(initialPrompt)

	// If simple agentId, use that and return
	if (agentConfig.type === "predefined") {
		return {
			requestConfig: {
				agentId: agentConfig.vendorAgent.id,
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
		model: vendorInfo.models.supported.includes(agentConfig.model) ? agentConfig.model : vendorInfo.models.default,
		inputs: mistralPrompt,
		instructions: agentConfig.instructions.join(". ")
	}
	// Tool if needed
	const documentLibraryTool: DocumentLibraryTool & { type: "document_library" } = {
		type: "document_library",
		libraryIds: [] as string[]
	}

	// If file search is enabled, create a library for the user and add document_library tool
	let userLibraryId: string | null = null
	if (agentConfig.vectorStoreEnabled) {
		const userLibrary = await mistralVendor.addVectorStore(`Library for conversation - add something useful here`, "Library created for conversation with document tools")
		userLibraryId = userLibrary.id
		documentLibraryTool.libraryIds.push(userLibrary.id)
	}
	// If preconfigured document libraries, add them as well
	if (agentConfig.vectorStoreIds && agentConfig.vectorStoreIds.length > 0) {
		documentLibraryTool.libraryIds.push(...agentConfig.vectorStoreIds)
	}
	// Add documentLibraryTool only if we have library ids
	if (documentLibraryTool.libraryIds.length > 0) {
		mistralConversationConfig.tools = [documentLibraryTool]
	}
	// If web search is enabled, add web_search tool
	if (agentConfig.webSearchEnabled) {
		throw new Error("Web search tool is not yet implemented for Mistral agents")
	}
	// Sjekkker om funksjonskall er aktivert og legger til tools-array om nødvendig
	if (agentConfig.functionsEnabled) {
		console.log("Legger til funksjoner:", mistralFunctionTools)
		if(!mistralConversationConfig.tools) {
			mistralConversationConfig.tools = []
		}
		// Dytter inn tools for hver funksjon vi har definert
		for (const tool of mistralFunctionTools) {
			mistralConversationConfig.tools.push({
				...tool, // Funksjonsbeskrivelsen fra mistral-functions.ts
				type: "function"
			})
		}
		console.log("La til liste med funksjoner for Mistral agent: ", mistralFunctionTools.map(f => f.function.parameters))
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

	public getAgentInfo(): IAgentResults["GetAgentInfoResult"] {
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

	public async createConversation(conversation: DBConversation, initialPrompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["CreateConversationResult"]> {
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

					return { vendorConversationId: value.data.conversationId, vectorStoreId: mistralConversationConfig.data.userLibraryId, response: readableStream }
				}
				if (done) {
					break // Oh no, vi fant ikke conversation response started event, har ikke noe å gå for... throw error under her
				}
			}
			throw new Error("Did not receive conversation started event from mistral, the dirty hack failed")
		}

		throw new Error("Non-streaming Mistral conversation creation is not yet implemented")
	}

	public async appendMessageToConversation(conversation: DBConversation, prompt: AgentPrompt, streamResponse: boolean): Promise<IAgentResults["AppendToConversationResult"]> {
		if (streamResponse) {
			const stream = await mistral.beta.conversations.appendStream({
				conversationId: conversation.vendorConversationId,
				conversationAppendStreamRequest: {
					inputs: createMistralPromptFromAgentPrompt(prompt)
				}
			})
			const readableStream = handleMistralStream(stream, undefined, undefined, conversation.vendorConversationId)
			return { response: readableStream }
		}
		throw new Error("Non-streaming Mistral conversation append is not yet implemented")
	}

	public async addConversationVectorStoreFiles(conversation: DBConversation, files: File[], streamResponse: boolean): Promise<IAgentResults["AddConversationVectorStoreFilesResult"]> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot add files")
		}
		if (streamResponse) {
			return await mistralVendor.addVectorStoreFiles(conversation.vectorStoreId, files, true)
		}
		throw new Error("Non-streaming Mistral conversation add files is not yet implemented")
	}

	public async getConversationVectorStoreFiles(conversation: DBConversation): Promise<IAgentResults["GetConversationVectorStoreFilesResult"]> {
		// Må hente filene som ligger i vector store knyttet til samtalen, må kanskje ha en get file også, som henter fildataene
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot get files")
		}
		return await mistralVendor.getVectorStoreFiles(conversation.vectorStoreId)
	}

	public async getConversationVectorStoreFileContent(conversation: DBConversation, fileId: string): Promise<IAgentResults["GetConversationVectorStoreFileContentResult"]> {
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

	public async deleteConversationVectorStoreFile(conversation: DBConversation, fileId: string): Promise<void> {
		if (!conversation.vectorStoreId) {
			throw new Error("Conversation does not have a vector store associated, cannot delete files")
		}
		if (!fileId) {
			throw new Error("File ID is required to delete vector store file")
		}
		await mistralVendor.deleteVectorStoreFile(conversation.vectorStoreId, fileId)
	}

	public async getConversationMessages(conversation: DBConversation): Promise<IAgentResults["GetConversationMessagesResult"]> {
		const conversationItems = await mistral.beta.conversations.getHistory({ conversationId: conversation.vendorConversationId }) // Får ascending order (tror jeg)
		// Write temp to file for now TODO - remove later
		writeFileSync("./ignore/mistral-conversation-items.json", JSON.stringify(conversationItems, null, 2))
		// Vi tar først bare de som er message, og mapper de om til Message type vårt system bruker
		const messages = conversationItems.entries.map((item) => createMessageFromMistralMessage(item))
		return { messages }
	}
}
