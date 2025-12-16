import z from "zod"
import { VendorConversation } from "./conversation"
import { VectorStore, VectorStoreFile } from "./vector-store"
import { SupportedVendorIds } from "./vendor-ids"

export const Vendor = z.object({
	id: SupportedVendorIds,
	name: z.string(),
	description: z.string(),
	models: z.object({
		supported: z.array(z.string()),
		default: z.string()
	})
})

export type Vendor = z.infer<typeof Vendor>

// RESULT TYPES
export const IVendorResults = {
	GetVendorInfoResult: Vendor,
	ListConversationsResult: z.object({
		vendorConversations: z.array(VendorConversation)
	}),
	ListVectorStoresResult: z.object({
		vectorstores: z.array(VectorStore)
	}),
	GetVectorStoreResult: z.object({
		vectorStore: VectorStore
	}),
	GetVectorStoreFilesResult: z.object({
		files: z.array(VectorStoreFile)
	}),
	AddVectorStoreResult: z.object({
		id: z.string(),
		vendorId: SupportedVendorIds
	})
}

export type IVendorResults = {
	GetVendorInfoResult: z.infer<typeof IVendorResults.GetVendorInfoResult>
	ListConversationsResult: z.infer<typeof IVendorResults.ListConversationsResult>
	ListVectorStoresResult: z.infer<typeof IVendorResults.ListVectorStoresResult>
	GetVectorStoreResult: z.infer<typeof IVendorResults.GetVectorStoreResult>
	GetVectorStoreFilesResult: z.infer<typeof IVendorResults.GetVectorStoreFilesResult>
	AddVectorStoreResult: z.infer<typeof IVendorResults.AddVectorStoreResult>
	AddVectorStoreFilesResult: {
		response: ReadableStream<Uint8Array>
	}
}

// VENDOR INTERFACE
export interface IVendor {
	/** Returns some static info about the AI Vendor */
	getVendorInfo(): Vendor
	/** Lists ALL conversations for the vendor */
	listConversations(): Promise<IVendorResults["ListConversationsResult"]>
	/** Deletes a conversation by its vendor-specific ID, only deletes the vendor conversation, not our DB-conversation */
	deleteConversation(vendorConversationId: string): Promise<void>
	/** Lists ALL vector stores for the vendor */
	listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]>
	/** Gets a specific vector store by its vendor-specific ID */
	getVectorStore(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]>
	/** Gets files in a specific vector store by its vendor-specific ID */
	getVectorStoreFiles(vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]>
	/** Adds a new vector store with the given name and description */
	addVectorStore(name: string, description: string): Promise<IVendorResults["AddVectorStoreResult"]>
	/** Deletes a vector store by its vendor-specific ID */
	deleteVectorStore(vendorVectorStoreId: string): Promise<void>
	/** Adds files to a specific vector store by its vendor-specific ID */
	addVectorStoreFiles(vendorVectorStoreId: string, files: File[], streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]>
	/** Deletes a file from a specific vector store by its vendor-specific ID and file ID */
	deleteVectorStoreFile(vendorVectorStoreId: string, fileId: string): Promise<void>
}
