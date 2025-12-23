import { Ollama } from "ollama"
import { env } from "$env/dynamic/private"
import type { IVendor, IVendorResults, Vendor } from "$lib/types/vendors"
import { MockVectorStoreDb } from "../db/vectorstore/mock_vectorstore"
import { MongoVectorStoreDb } from "../db/vectorstore/mongodb_vectorstore"
import type { IVectorStoreDb } from "../db/vectorstore/interface"
import type { VectorContext } from "../db/vectorstore/types"
import { fileToChunks, mapVectorContextToVectorStore } from "../db/vectorstore/vectorUtil"
import type { IEmbedder } from "../embeddings/interface"
import { OllamaEmbedder } from "../embeddings/ollama_embedder"
import { createSse } from "$lib/streaming"

if (!env.SUPPORTED_MODELS_VENDOR_OLLAMA || env.SUPPORTED_MODELS_VENDOR_OLLAMA.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_OLLAMA is not set in environment variables")
}
const OLLAMA_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_OLLAMA.split(",").map((model) => model.trim())
const OLLAMA_DEFAULT_MODEL = OLLAMA_SUPPORTED_MODELS[0] as string

export const ollama = new Ollama({ host: "http://127.0.0.1:11434" })

export const getVectorStore = (): IVectorStoreDb => {
	if (env.MOCK_DB) {
		return new MockVectorStoreDb()
	}
	return new MongoVectorStoreDb()
}


export class OllamaVendor implements IVendor {

	private vectorStore: IVectorStoreDb
	private embedder: IEmbedder

	constructor(embedder?: IEmbedder | null, vectorStore?: IVectorStoreDb | null) {
		this.embedder = embedder || new OllamaEmbedder()
		this.vectorStore = vectorStore || getVectorStore()
	}

	public getVendorInfo(): Vendor {
		return {
			id: "ollama",
			name: "Ollama",
			description: "Ollama - run large language models locally on your machine/server.",
			models: {
				supported: OLLAMA_SUPPORTED_MODELS,
				default: OLLAMA_DEFAULT_MODEL
			}
		}
	}
	
	public async listConversations(): Promise<IVendorResults["ListConversationsResult"]> {
		throw new Error("Method not implemented.")
	}

	public async deleteConversation(_vendorConversationId: string): Promise<void> {
		throw new Error("Method not implemented.")
	}

	public async listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]> {
		this.vectorStore.getContexts()
		const contexts = await this.vectorStore.getContexts()
		return { vectorstores: contexts.map((context) => mapVectorContextToVectorStore(context, 'ollama')) }
	}

	public async getVectorStore(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to get vector store")
		}
		const context = await this.vectorStore.getContext(vendorVectorStoreId)
		if (!context) {
			throw new Error("Vector store ID is required to get vector store")
		}

		return { vectorStore: mapVectorContextToVectorStore(context, "ollama") }
	}

	public async getVectorStoreFiles(_vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]> {
		const files = await this.vectorStore.getFiles(_vendorVectorStoreId)
		return { files }
	}

	public async addVectorStore(name: string, _description: string): Promise<IVendorResults["AddVectorStoreResult"]> {
		const vectorContext: VectorContext = await this.vectorStore.createContext({ name: name })
		return {
			id: vectorContext.contextId,
			vendorId: "ollama"
		}
	}

	public async deleteVectorStore(_vendorVectorStoreId: string): Promise<void> {
		throw new Error("Method not implemented.")
	}

	public async addVectorStoreFiles(vendorVectorStoreId: string, files: File[], streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to add files")
		}

		const context = await this.vectorStore.getContext(vendorVectorStoreId)
		if (!context) {
			throw new Error(`Vector store with ID ${vendorVectorStoreId} does not exist`)
		}

		if (streamResponse) {
			for (const file of files) {
				const vectorStrings: string[] = await fileToChunks(file)
				const embeddings = await this.embedder.embedMultiple(vectorStrings)
				const vectorFile = await this.vectorStore.makeFile(vendorVectorStoreId, file.name, file.size)
				this.vectorStore.addVectorData(vendorVectorStoreId, vectorFile.id, vectorStrings, embeddings)
			}
			const readableStream = new ReadableStream({
				async start(controller) {
					for (const file of files) {
						controller.enqueue(createSse({ event: "agent.vectorstore.file.processed", data: { fileId: crypto.randomUUID(), fileName: file.name } }))
					}
				}
			})

			return { response: readableStream }
		}

		throw new Error("Non-streaming add files is not yet implemented")
	}

	public async deleteVectorStoreFile(vendorVectorStoreId: string, fileId: string): Promise<void> {
		await this.vectorStore.removeFile(vendorVectorStoreId, fileId)
	}
}
