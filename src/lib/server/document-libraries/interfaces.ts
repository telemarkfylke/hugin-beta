import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { MongoLibraryDocumentStore } from "./mongo-store"
import type { DocumentLibraryMapping } from "./types"

let mappingStore: ILibraryMappingStore | null = null

export function getLibraryMappingStore(): ILibraryMappingStore {
	if (!mappingStore) {
		const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING)
		mappingStore = new MongoLibraryDocumentStore(mongoClient)
	}
	return mappingStore
}

export interface ILibraryMappingStore {
	getLibraryMapping(chatConfigId: string, libraryVendor: string): Promise<DocumentLibraryMapping | null>
	getVendorIds(chatConfigId: string, libraryVendor: string): Promise<string[]>
	upsertLibraryMapping(chatConfigId: string, libraryVendor: string, mappings: string[]): Promise<boolean>
}
