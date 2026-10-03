import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
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
	private indexesEnsured = false

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

	// Same reasoning as MongoMcpSourceStore's ensureIndexes - getWebsiteSources below pushes its
	// visibility filter into the query instead of fetching every document and narrowing in
	// application code, and these two indexes back that query's `$or` (one per branch - Mongo needs
	// an index per top-level $or clause, not one compound index across both). Takes the
	// already-resolved Db rather than calling getDb() itself so every method below keeps its own
	// collection<T>() typing (insert/replace need NewWebsiteSource, everything else needs
	// DbWebsiteSource) instead of all sharing one collection type.
	private async ensureIndexes(db: Db): Promise<void> {
		if (this.indexesEnsured) {
			return
		}
		const collection = db.collection(this.collectionName)
		await Promise.all([collection.createIndex({ type: 1 }), collection.createIndex({ "createdBy.id": 1 })]).catch((error) => {
			logger.errorException(error, "Failed to ensure website-sources indexes - getWebsiteSources still works correctly, just via a slower collection scan")
		})
		this.indexesEnsured = true
	}

	async getWebsiteSource(sourceId: string): Promise<WebsiteSource | null> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const source = await db.collection<DbWebsiteSource>(this.collectionName).findOne({ _id: new ObjectId(sourceId) })
		if (!source) {
			return null
		}
		return { ...source, _id: source._id.toString() }
	}

	async getWebsiteSources(principal: AuthenticatedPrincipal): Promise<WebsiteSource[]> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const collection: Collection<DbWebsiteSource> = db.collection(this.collectionName)
		// Mirrors MongoMcpSourceStore.getMcpSources - see its comment for why canViewWebsiteSource is
		// still applied below on the (now much smaller) result set rather than being trusted to the
		// query alone.
		const isAdmin = principal.roles.includes(APP_CONFIG.APP_ROLES.ADMIN)
		const query: Filter<DbWebsiteSource> = isAdmin ? {} : { $or: [{ type: "published" }, { "createdBy.id": principal.userId }] }
		const sources = (await collection.find(query).toArray()).map((source) => ({ ...source, _id: source._id.toString() }))
		return sources.filter((source) => canViewWebsiteSource(source, principal, APP_CONFIG.APP_ROLES))
	}

	async createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const collection: Collection<NewWebsiteSource> = db.collection(this.collectionName)
		const result = await collection.insertOne(source)
		return { ...source, _id: result.insertedId.toString() }
	}

	async replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
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
