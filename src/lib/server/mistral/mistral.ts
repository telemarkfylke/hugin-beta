import { Mistral } from "@mistralai/mistralai"
import { env } from "$env/dynamic/private"
import type { VendorConversation } from "$lib/types/conversation"
import type { IVendor, IVendorResults } from "$lib/types/vendors"
import { getDocumentsInMistralLibrary, getMistralLibraries, getMistralLibrary, uploadFilesToMistralLibrary } from "./document-library"

if (!env.SUPPORTED_MODELS_VENDOR_MISTRAL || env.SUPPORTED_MODELS_VENDOR_MISTRAL.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_MISTRAL is not set in environment variables")
}
const MISTRAL_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_MISTRAL.split(",").map((model) => model.trim())
const MISTRAL_DEFAULT_MODEL = MISTRAL_SUPPORTED_MODELS[0] as string

export const mistral = new Mistral({
	apiKey: env.MISTRAL_API_KEY || "bare-en-tulle-key"
})

export class MistralVendor implements IVendor {
	public getVendorInfo(): IVendorResults["GetVendorInfoResult"] {
		return {
			id: "mistral",
			name: "Mistral AI",
			description: "Mistral AI - cutting-edge language models and AI solutions.",
			models: {
				supported: MISTRAL_SUPPORTED_MODELS,
				default: MISTRAL_DEFAULT_MODEL
			}
		}
	}

	public async listConversations(): Promise<IVendorResults["ListConversationsResult"]> {
		const conversations = await mistral.beta.conversations.list({
			pageSize: 100
		})
		// TODO: pagination
		const mappedConversations: VendorConversation[] = conversations.map((mistralConv) => {
			return {
				id: mistralConv.id,
				vendorId: "mistral",
				createdAt: mistralConv.createdAt.toISOString(),
				title: mistralConv.name || null
			}
		})
		return { vendorConversations: mappedConversations }
	}

	public async deleteConversation(vendorConversationId: string): Promise<void> {
		// Not supported by SDK yet, so we do it manually
		const deleteResponse = await fetch(`https://api.mistral.ai/v1/conversations/${vendorConversationId}`, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${env.MISTRAL_API_KEY}`
			}
		})
		if (!deleteResponse.ok) {
			const errorBody = await deleteResponse.text()
			throw new Error(`Failed to delete Mistral conversation ${vendorConversationId}: ${deleteResponse.status} - ${errorBody}`)
		}
	}

	public async listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]> {
		const vectorStores = await getMistralLibraries()
		return { vectorstores: vectorStores }
	}

	public async getVectorStore(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]> {
		const vectorStore = await getMistralLibrary(vendorVectorStoreId)
		return { vectorStore }
	}

	public async getVectorStoreFiles(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]> {
		const files = await getDocumentsInMistralLibrary(vendorVectorStoreId)
		return { files }
	}

	public async addVectorStore(name: string, description: string): Promise<IVendorResults["AddVectorStoreResult"]> {
		const library = await mistral.beta.libraries.create({
			name,
			description
		})
		return {
			id: library.id,
			vendorId: "mistral"
		}
	}

	public async deleteVectorStore(vendorVectorStoreId: string): Promise<void> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to delete vector store")
		}
		await mistral.beta.libraries.delete({
			libraryId: vendorVectorStoreId
		})
	}

	public async addVectorStoreFiles(vendorVectorStoreId: string, files: File[], streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to add files")
		}
		if (streamResponse) {
			const readableStream = await uploadFilesToMistralLibrary(vendorVectorStoreId, files, true)
			return { response: readableStream }
		}
		throw new Error("Non-streaming Mistral conversation add files is not yet implemented")
	}

	public async deleteVectorStoreFile(vendorVectorStoreId: string, fileId: string): Promise<void> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to delete files")
		}
		if (!fileId) {
			throw new Error("File ID is required to delete file from vector store")
		}
		console.log(`Deleting document ${fileId} from Mistral library ${vendorVectorStoreId}`)
		await mistral.beta.libraries.documents.delete({
			libraryId: vendorVectorStoreId,
			documentId: fileId
		})
		console.log(`Deleted document ${fileId} from Mistral library ${vendorVectorStoreId}`) // TODO - status på at en fil driver å sletter?
	}
}
