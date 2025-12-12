import OpenAI from "openai"
import { env } from "$env/dynamic/private"
import type { IVendor, IVendorResults, Vendor } from "$lib/types/vendors"
import { getOpenAIVectorStore, getOpenAIVectorStoreFiles, getOpenAIVectorStores, uploadFilesToOpenAIVectorStore } from "./vector-store"

if (!env.SUPPORTED_MODELS_VENDOR_OPENAI || env.SUPPORTED_MODELS_VENDOR_OPENAI.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_OPENAI is not set in environment variables")
}
const OPEN_AI_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_OPENAI.split(",").map((model) => model.trim())
const OPEN_AI_DEFAULT_MODEL = OPEN_AI_SUPPORTED_MODELS[0] as string

export const openai = new OpenAI({
	apiKey: env.OPENAI_API_KEY || "bare-en-tulle-key"
})

export class OpenAIVendor implements IVendor {
	public getVendorInfo(): Vendor {
		return {
			id: "openai",
			name: "OpenAI",
			description: "OpenAI - pioneers in artificial intelligence research and deployment.",
			models: {
				supported: OPEN_AI_SUPPORTED_MODELS,
				default: OPEN_AI_DEFAULT_MODEL
			}
		}
	}
	public async listConversations(): Promise<IVendorResults["ListConversationsResult"]> {
		// SDK støtter ikke conversations for OpenAI per nå, må hentes i dashboard inntil videre...
		throw new Error("OpenAI list conversations not supported. Must be done via dashboard (logs).")
	}
	public async deleteConversation(vendorConversationId: string): Promise<void> {
		if (!vendorConversationId) {
			throw new Error("Conversation ID is required to delete conversation")
		}
		await openai.conversations.delete(vendorConversationId)
	}
	public async listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]> {
		const vectorStores = await getOpenAIVectorStores()
		return { vectorstores: vectorStores }
	}
	public async getVectorStore(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to get vector store")
		}
		const vectorStore = await getOpenAIVectorStore(vendorVectorStoreId)
		return { vectorStore }
	}
	public async getVectorStoreFiles(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]> {
		const vectorStoreFiles = await getOpenAIVectorStoreFiles(vendorVectorStoreId)
		return { files: vectorStoreFiles }
	}
	public async addVectorStore(name: string, description: string): Promise<IVendorResults["AddVectorStoreResult"]> {
		const vectorStore = await openai.vectorStores.create({
			name,
			description,
			expires_after: {
				anchor: "last_active_at",
				days: 1
			}
		})
		return {
			id: vectorStore.id,
			vendorId: "openai"
		}
	}
	public async deleteVectorStore(vendorVectorStoreId: string): Promise<void> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to delete vector store")
		}
		await openai.vectorStores.delete(vendorVectorStoreId)
	}
	public async addVectorStoreFiles(vendorVectorStoreId: string, files: File[], streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to add files")
		}
		if (streamResponse) {
			const uploadResult = await uploadFilesToOpenAIVectorStore(vendorVectorStoreId, files, true)
			return uploadResult
		}
		throw new Error("Non-streaming OpenAI conversation add files is not yet implemented")
	}
	public async deleteVectorStoreFile(vendorVectorStoreId: string, fileId: string): Promise<void> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to delete file from vector store")
		}
		if (!fileId) {
			throw new Error("File ID is required to delete file from vector store")
		}
		// First delete from vector store - OpenAI says that deleting the file will also remove it from vector store, but that is not the case (https://platform.openai.com/docs/api-reference/files/delete)
		const deleteFromVectorStore = await openai.vectorStores.files.delete(fileId, { vector_store_id: vendorVectorStoreId })
		console.log("Delete from vector store response:", deleteFromVectorStore)
		if (!deleteFromVectorStore.deleted) {
			throw new Error(`Failed to delete file ${fileId} from OpenAI vector store ${vendorVectorStoreId}`)
		}
		const deleteFileResponse = await openai.files.delete(fileId)
		console.log("Delete file response:", deleteFileResponse)
		if (!deleteFileResponse.deleted) {
			throw new Error(`Failed to delete file ${fileId} from OpenAI files`)
		}
	}
}
