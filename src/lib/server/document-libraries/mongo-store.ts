import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { ILibraryMappingStore } from "./interfaces"
import type { DocumentLibraryMapping } from "./types"

export class MongoLibraryDocumentStore implements ILibraryMappingStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly collectionName: string

	constructor(mongoClient: MongoClient) {
		if (!env.MONGODB_CONNECTION_STRING) {
			throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
		}
		if (!env.MONGODB_DB_NAME) {
			throw new Error("MONGODB_DB_NAME is not set (du har glemt den)")
		}
		this.mongoClient = mongoClient
		this.collectionName = "library-mappings"
	}

	private async getDb(): Promise<Db> {
		if (this.db) {
			return this.db
		}
		try {
			await this.mongoClient.connect()
			this.db = this.mongoClient.db(env.MONGODB_DB_NAME)
			return this.db
		} catch (error) {
			logger.errorException(error, "Error when connecting to MongoDB")
			throw error
		}
	}

	async getLibraryMapping(chatConfigId: string): Promise<DocumentLibraryMapping | null> {
		const db = await this.getDb()
		const libraryMapping = await db.collection<DocumentLibraryMapping>(this.collectionName).findOne({ _id: new ObjectId(chatConfigId) })
		if (!libraryMapping) {
			return null
		}
		return libraryMapping
	}

	async getVendorIds(chatConfigId: string, libraryVendor: string): Promise<string[]> {
		const db = await this.getDb()
		const libraryMapping = await db.collection<DocumentLibraryMapping>(this.collectionName).findOne({ _id: new ObjectId(chatConfigId) })
		if (!libraryMapping) {
			return []
		}
		return libraryMapping.libraryIds[libraryVendor] || []
	}

	async upsertLibraryMapping(chatConfigId: string, libraryVendor: string, mappings: string[]): Promise<boolean> {
		const db = await this.getDb()
		const collection: Collection<DocumentLibraryMapping> = db.collection(this.collectionName)
		const libraryMapping = await collection.findOne({ _id: new ObjectId(chatConfigId) })

		if (!libraryMapping) {
			const mapping: DocumentLibraryMapping = {
				_id: new ObjectId(chatConfigId),
				libraryIds: {}
			}
			mapping.libraryIds[libraryVendor] = mappings
			const result = await collection.insertOne(mapping)
			return result.insertedId != null
		} else {
			const path = `libraryIds.${libraryVendor}`
			const result = await collection.updateOne(
				{
					_id: new ObjectId(chatConfigId)
				},
				{ $set: { [path]: mappings } }
			)
			return result.modifiedCount > 0
		}
	}
}

/*
	getLibraryMapping(chatConfigId: string, libraryVendor: string): Promise<DocumentLibraryMapping | null>
	upsertLibraryMapping(chatConfigId: string, libraryVendor: string, mappings: string[]): Promise<DocumentLibraryMapping>
*/
