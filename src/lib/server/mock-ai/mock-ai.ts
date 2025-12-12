import { env } from "$env/dynamic/private"
import type { VendorConversation } from "$lib/types/conversation"
import type { VectorStoreFile } from "$lib/types/vector-store"
import type { IVendor, IVendorResults } from "$lib/types/vendors"
import { uploadFilesToMockAI } from "./mock-ai-files"

if (!env.SUPPORTED_MODELS_VENDOR_MOCKAI || env.SUPPORTED_MODELS_VENDOR_MOCKAI.trim() === "") {
	throw new Error("SUPPORTED_MODELS_VENDOR_MOCKAI is not set in environment variables")
}
const MOCKAI_SUPPORTED_MODELS = env.SUPPORTED_MODELS_VENDOR_MOCKAI.split(",").map((model) => model.trim())
const MOCKAI_DEFAULT_MODEL = MOCKAI_SUPPORTED_MODELS[0] as string

export class MockAIVendor implements IVendor {
	public getVendorInfo(): IVendorResults["GetVendorInfoResult"] {
		return {
			id: "mock-ai",
			name: "Mock AI",
			description: "Mock AI - bare drit og møkk",
			models: {
				supported: MOCKAI_SUPPORTED_MODELS,
				default: MOCKAI_DEFAULT_MODEL
			}
		}
	}

	public async listConversations(): Promise<IVendorResults["ListConversationsResult"]> {
		const conversations: VendorConversation[] = [
			{
				id: "conv-1",
				vendorId: "mock-ai",
				createdAt: new Date().toISOString(),
				title: "Mock Conversation 1"
			},
			{
				id: "conv-2",
				vendorId: "mock-ai",
				createdAt: new Date().toISOString(),
				title: "Mock Conversation 2"
			}
		]
		return { vendorConversations: conversations }
	}

	public async deleteConversation(_vendorConversationId: string): Promise<void> {
		return
	}

	public async listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]> {
		return {
			vectorstores: [
				{
					id: "vs-1",
					generatedDescription: null,
					numberOfFiles: 2,
					totalBytes: 2048,
					updatedAt: new Date().toISOString(),
					vendorId: "mock-ai",
					name: "Mock Vector Store 1",
					description: "This is a mock vector store",
					createdAt: new Date().toISOString()
				}
			]
		}
	}

	public async getVectorStore(_vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]> {
		return {
			vectorStore: {
				id: "vs-1",
				generatedDescription: null,
				numberOfFiles: 2,
				totalBytes: 2048,
				updatedAt: new Date().toISOString(),
				vendorId: "mock-ai",
				name: "Mock Vector Store 1",
				description: "This is a mock vector store",
				createdAt: new Date().toISOString()
			}
		}
	}

	public async getVectorStoreFiles(_vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]> {
		const files: VectorStoreFile[] = [
			{
				id: "file-1",
				name: "document1.pdf",
				bytes: 1024,
				status: "ready",
				type: "application/pdf",
				summary: null
			}
		]
		return { files }
	}

	public async addVectorStore(_name: string, _description: string): Promise<IVendorResults["AddVectorStoreResult"]> {
		return {
			id: "vs-new",
			vendorId: "mock-ai"
		}
	}

	public async deleteVectorStore(_vendorVectorStoreId: string): Promise<void> {
		return
	}

	public async addVectorStoreFiles(vendorVectorStoreId: string, files: File[], streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]> {
		if (!vendorVectorStoreId) {
			throw new Error("Vector store ID is required to add files")
		}
		if (streamResponse) {
			const readableStream = await uploadFilesToMockAI(vendorVectorStoreId, files, true)
			return { response: readableStream }
		}
		throw new Error("Non-streaming Mock AI conversation add files is not yet implemented")
	}

	public async deleteVectorStoreFile(_vendorVectorStoreId: string, _fileId: string): Promise<void> {
		return
	}
}
