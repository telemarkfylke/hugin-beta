import type { LibraryOut } from "@mistralai/mistralai/models/components"
import { createSse } from "$lib/streaming.js"
import type { VectorStore, VectorStoreFile } from "$lib/types/vector-store"
import { mistral } from "./mistral"

// Document libraries in Mistral are vector stores, but called libraries

export const uploadFilesToMistralLibrary = async (libraryId: string, files: File[], streamResponse: boolean): Promise<ReadableStream> => {
	if (!libraryId) {
		throw new Error("libraryId is required to upload files to Mistral")
	}
	if (!files || files.length === 0) {
		throw new Error("At least one file is required to upload files to Mistral")
	}
	// Maybe validate files types as well here
	if (streamResponse) {
		const readableStream = new ReadableStream({
			async start(controller) {
				for (const file of files) {
					try {
						const result = await mistral.beta.libraries.documents.upload({
							libraryId,
							requestBody: {
								file
							}
						})
						controller.enqueue(createSse({ event: "conversation.vectorstore.file.uploaded", data: { fileId: result.id, fileName: file.name } }))
						let fileProcessed = false
						// Polling for document processing status
						while (!fileProcessed) {
							const status = await mistral.beta.libraries.documents.status({
								libraryId,
								documentId: result.id
							})
							console.log("Document status:", status.processingStatus)
							if (status.processingStatus === "Completed") {
								await new Promise((resolve) => setTimeout(resolve, 3000)) // Wait a bit to ensure document is fully processed
								fileProcessed = true
								break
							}
							if (status.processingStatus !== "Running") {
								controller.enqueue(createSse({ event: "error", data: { message: `Error processing document ${file.name}: status ${status.processingStatus}` } }))
							}
							// Wait for a few seconds before polling again
							await new Promise((resolve) => setTimeout(resolve, 3000))
						}
						controller.enqueue(createSse({ event: "conversation.vectorstore.files.processed", data: { vectorStoreId: libraryId, files: [{ fileId: result.id }] } }))
					} catch (error) {
						controller.enqueue(createSse({ event: "error", data: { message: `Error uploading document ${file.name} to Mistral library: ${error}` } }))
						controller.close()
						break
					}
				}
				controller.close()
			}
		})
		return readableStream
	}

	throw new Error("Regular upload not implemented yet")
}

export const getDocumentsInMistralLibrary = async (libraryId: string): Promise<VectorStoreFile[]> => {
	if (!libraryId) {
		throw new Error("libraryId is required to get documents from Mistral library")
	}
	const documents = await mistral.beta.libraries.documents.list({
		libraryId,
		pageSize: 100
	})
	const files: VectorStoreFile[] = documents.data.map((doc) => {
		return {
			id: doc.id,
			type: doc.mimeType,
			name: doc.name,
			bytes: doc.size,
			status: "ready", // TODO, sjekk hva de dumme statusene til Mistral er... og mappe de til våre egne
			summary: doc.summary || null,
			uploadedAt: doc.createdAt.toISOString()
		}
	})
	return files
}

const mapLibraryToVectorStore = (library: LibraryOut): VectorStore => {
	const vectorStore: VectorStore = {
		id: library.id,
		vendorId: "mistral",
		name: library.name,
		description: library.description || "No description provided",
		generatedDescription: library.generatedDescription || null,
		numberOfFiles: library.nbDocuments,
		totalBytes: library.totalSize,
		createdAt: library.createdAt.toISOString(),
		updatedAt: library.updatedAt ? library.updatedAt.toISOString() : null
	}
	return vectorStore
}

export const getMistralLibrary = async (libraryId: string): Promise<VectorStore> => {
	if (!libraryId) {
		throw new Error("libraryId is required to get Mistral library")
	}
	const library = await mistral.beta.libraries.get({
		libraryId
	})
	return mapLibraryToVectorStore(library)
}

export const getMistralLibraries = async (): Promise<VectorStore[]> => {
	// Inntil videre går det bare å liste alle libraries hos Mistral uten filtrering...
	const libraries = await mistral.beta.libraries.list()
	return libraries.data.map(mapLibraryToVectorStore)
}
