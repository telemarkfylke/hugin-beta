import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"
import type { IMcpSourceStore } from "./interface"

type DbMcpSource = Omit<McpSource, "_id"> & { _id: ObjectId }

export class MongoMcpSourceStore implements IMcpSourceStore {
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
		this.collectionName = "mcp-sources"
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

	async getMcpSource(sourceId: string): Promise<McpSource | null> {
		const db = await this.getDb()
		const source = await db.collection<DbMcpSource>(this.collectionName).findOne({ _id: new ObjectId(sourceId) })
		if (!source) {
			return null
		}
		return { ...source, _id: source._id.toString() }
	}

	async getMcpSources(): Promise<McpSource[]> {
		const db = await this.getDb()
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		return (await collection.find({}).toArray()).map((source) => ({ ...source, _id: source._id.toString() }))
	}

	async createMcpSource(source: NewMcpSource): Promise<McpSource> {
		const db = await this.getDb()
		const collection: Collection<NewMcpSource> = db.collection(this.collectionName)
		const result = await collection.insertOne(source)
		return { ...source, _id: result.insertedId.toString() }
	}

	async replaceMcpSource(sourceId: string, source: NewMcpSource): Promise<McpSource> {
		const db = await this.getDb()
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		await collection.replaceOne({ _id: new ObjectId(sourceId) }, source)
		return { ...source, _id: sourceId }
	}

	async deleteMcpSource(sourceId: string): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		await collection.deleteOne({ _id: new ObjectId(sourceId) })
	}
}
