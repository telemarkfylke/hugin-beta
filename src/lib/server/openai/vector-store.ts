import { APIError } from "openai"
import type { VectorStore as OpenAIVectorStore } from "openai/resources"
import { createSse } from "$lib/streaming.js"
import type { VectorStore, VectorStoreFile } from "$lib/types/vector-store.js"
import { openai } from "./openai.js"

/**
 * Upload documents to OpenAI Vector Store.
 */
export const uploadFilesToOpenAIVectorStore = async (vectorStoreId: string, files: File[], streamResponse: boolean): Promise<{ response: ReadableStream }> => {
	if (!vectorStoreId) {
		throw new Error("Vector store ID is required to upload files to OpenAI vector store")
	}
	if (!files || files.length === 0) {
		throw new Error("At least one file is required to upload files to OpenAI library")
	}
	// Maybe validate files types as well here
	if (streamResponse) {
		const readableStream = new ReadableStream({
			async start(controller) {
				const fileIds: string[] = []
				for (const file of files) {
					try {
						const result = await openai.files.create({
							file,
							purpose: "user_data",
							expires_after: {
								anchor: "created_at",
								seconds: 86400 // 1 day
							}
						})
						fileIds.push(result.id)
						controller.enqueue(createSse({ event: "conversation.vectorstore.file.uploaded", data: { fileId: result.id, fileName: result.filename } }))
					} catch (error) {
						controller.enqueue(createSse({ event: "error", data: { message: `Error uploading file ${file.name} to OpenAI library: ${error}` } }))
						controller.close()
						break
					}
				}
				// Now link files to vector store
				try {
					const batchCreationResult = await openai.vectorStores.fileBatches.create(vectorStoreId, { file_ids: fileIds })
					let batchProcessed = false
					// Polling for document processing status
					while (!batchProcessed) {
						const batchResult = await openai.vectorStores.fileBatches.retrieve(batchCreationResult.id, { vector_store_id: vectorStoreId })
						console.log("Batch status:", batchResult.status)
						if (batchResult.status === "completed") {
							await new Promise((resolve) => setTimeout(resolve, 3000)) // Wait a bit to ensure document is fully processed
							batchProcessed = true
							break
						}
						if (batchResult.status !== "in_progress") {
							controller.enqueue(createSse({ event: "error", data: { message: `Error processing files in batch id ${batchResult.id}: status ${batchResult.status}` } }))
						}
						// Wait for a few seconds before polling again
						await new Promise((resolve) => setTimeout(resolve, 3000))
					}
					controller.enqueue(createSse({ event: "conversation.vectorstore.files.processed", data: { files: fileIds.map((id) => ({ fileId: id })), vectorStoreId } }))
				} catch (error) {
					controller.enqueue(createSse({ event: "error", data: { message: `Error uploading documents to Open AI Vector store: ${error}` } }))
					controller.close()
				}
				controller.close()
			}
		})

		return { response: readableStream }
	}

	throw new Error("Regular upload not implemented yet")
}

export const getOpenAIVectorStoreFiles = async (vectorStoreId: string): Promise<VectorStoreFile[]> => {
	// Må først hente liste over filer i vector store fra OpenAI, deretter hente filinformasjon fra files i openai
	const vectorStoreFiles = await openai.vectorStores.files.list(vectorStoreId, { limit: 100 })

	// Så henter vi filinformasjon for hver fil
	const getFilePromises = vectorStoreFiles.data.map(async (vsFile) => {
		try {
			const fileInfo = await openai.files.retrieve(vsFile.id)
			return {
				...fileInfo,
				status: vsFile.status
			}
		} catch (error) {
			if (error instanceof APIError && error.status === 404) {
				console.warn(`File with id ${vsFile.id} not found in OpenAI files. Probably deleted, returning null`)
				return null
			}
			throw error
		}
	})
	const files = (await Promise.all(getFilePromises)).filter((file) => file !== null)
	return files.map((file) => {
		return {
			id: file.id,
			name: file.filename,
			type: "open-ai-drittfil", // todo, finn mimeType eller noe, den ekke der
			bytes: file.bytes,
			summary: null, // OpenAI gir ikke summary per nå
			status: file.status === "completed" ? "ready" : file.status === "failed" ? "error" : "processing" // Obs, Jørgen er lat, men det går sikkert bra
		}
	})
}

const mapOpenAIVectorStoreToVectorStore = (openAIVectorStore: OpenAIVectorStore): VectorStore => {
	return {
		id: openAIVectorStore.id,
		vendorId: "openai",
		name: openAIVectorStore.name,
		// @ts-expect-error SDK mangler description på typene sine, jeg vil se om den er der
		description: openAIVectorStore.description || "",
		generatedDescription: "",
		createdAt: new Date(openAIVectorStore.created_at).toISOString(),
		numberOfFiles: openAIVectorStore.file_counts.total || 0,
		totalBytes: openAIVectorStore.usage_bytes || 0,
		updatedAt: openAIVectorStore.last_active_at ? new Date(openAIVectorStore.last_active_at).toISOString() : null
	}
}

export const getOpenAIVectorStores = async (): Promise<VectorStore[]> => {
	const vectorStores = await openai.vectorStores.list({ limit: 100 })
	return vectorStores.data.map((vectorStore) => mapOpenAIVectorStoreToVectorStore(vectorStore))
}

export const getOpenAIVectorStore = async (vectorStoreId: string): Promise<VectorStore> => {
	const vectorStore = await openai.vectorStores.retrieve(vectorStoreId)
	return mapOpenAIVectorStoreToVectorStore(vectorStore)
}
