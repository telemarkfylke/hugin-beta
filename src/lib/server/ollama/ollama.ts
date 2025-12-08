import { Ollama } from "ollama"

import type { IVendor, IVendorResults, Vendor } from "$lib/types/vendors"

export const ollama = new Ollama({ host: "http://127.0.0.1:11434" })

export class OllamaVendor implements IVendor {
	public getVendorInfo(): Vendor {
		return {
			id: "ollama",
			name: "Ollama",
			description: "Ollama - run large language models locally on your machine/server."
		}
	}
	public async listConversations(): Promise<IVendorResults["ListConversationsResult"]> {
		throw new Error("Method not implemented.")
	}
	public async deleteConversation(_vendorConversationId: string): Promise<void> {
		throw new Error("Method not implemented.")
	}
	public async listVectorStores(): Promise<IVendorResults["ListVectorStoresResult"]> {
		throw new Error("Method not implemented.")
	}
	public async getVectorStore(_vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreResult"]> {
		throw new Error("Method not implemented.")
	}
	public async getVectorStoreFiles(_vendorVectorStoreId: string): Promise<IVendorResults["GetVectorStoreFilesResult"]> {
		throw new Error("Method not implemented.")
	}
	public async addVectorStore(_name: string, _description: string): Promise<IVendorResults["AddVectorStoreResult"]> {
		throw new Error("Method not implemented.")
	}
	public async deleteVectorStore(_vendorVectorStoreId: string): Promise<void> {
		throw new Error("Method not implemented.")
	}
	public async addVectorStoreFiles(_vendorVectorStoreId: string, _files: File[], _streamResponse: boolean): Promise<IVendorResults["AddVectorStoreFilesResult"]> {
		throw new Error("Method not implemented.")
	}
	public async deleteVectorStoreFile(_vendorVectorStoreId: string, _fileId: string): Promise<void> {
		throw new Error("Method not implemented.")
	}
}
