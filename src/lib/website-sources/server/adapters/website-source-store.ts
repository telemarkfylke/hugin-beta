import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import { canViewWebsiteSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { NewWebsiteSource, WebsiteSource } from "$lib/types/website-source"
import type { IWebsiteSourceStore } from "./interface"

type DbWebsiteSource = Omit<WebsiteSource, "_id"> & { _id: ObjectId }

export class MongoWebsiteSourceStore implements IWebsiteSourceStore {
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
		this.collectionName = "website-sources"
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

	async getWebsiteSource(sourceId: string): Promise<WebsiteSource | null> {
		const db = await this.getDb()
		const source = await db.collection<DbWebsiteSource>(this.collectionName).findOne({ _id: new ObjectId(sourceId) })
		if (!source) {
			return null
		}
		return { ...source, _id: source._id.toString() }
	}

	async getWebsiteSources(principal: AuthenticatedPrincipal): Promise<WebsiteSource[]> {
		const db = await this.getDb()
		const collection: Collection<DbWebsiteSource> = db.collection(this.collectionName)
		const sources = (await collection.find({}).toArray()).map((source) => ({ ...source, _id: source._id.toString() }))
		return sources.filter((source) => canViewWebsiteSource(source, principal, APP_CONFIG.APP_ROLES))
	}

	async createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource> {
		const db = await this.getDb()
		const collection: Collection<NewWebsiteSource> = db.collection(this.collectionName)
		const result = await collection.insertOne(source)
		return { ...source, _id: result.insertedId.toString() }
	}

	async replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource> {
		const db = await this.getDb()
		const collection: Collection<DbWebsiteSource> = db.collection(this.collectionName)
		await collection.replaceOne({ _id: new ObjectId(sourceId) }, source)
		return { ...source, _id: sourceId }
	}

	async deleteWebsiteSource(sourceId: string): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbWebsiteSource> = db.collection(this.collectionName)
		await collection.deleteOne({ _id: new ObjectId(sourceId) })
	}
}
