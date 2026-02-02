import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import { canViewAllChatConfigs } from "$lib/authorization"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, DbChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { APP_CONFIG } from "../app-config/app-config"

export class MongoChatConfigStore implements IChatConfigStore {
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
		if (!env.MONGODB_CHAT_CONFIG_COLLECTION) {
			throw new Error("MONGODB_CHAT_CONFIG_COLLECTION is not set (du har glemt den)")
		}
		this.mongoClient = mongoClient
		this.collectionName = env.MONGODB_CHAT_CONFIG_COLLECTION
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

	async getChatConfig(configId: string): Promise<ChatConfig | null> {
		const db = await this.getDb()
		const chatConfig = await db.collection<DbChatConfig>(this.collectionName).findOne({ _id: new ObjectId(configId) })
		if (!chatConfig) {
			return null
		}
		return { ...chatConfig, _id: chatConfig._id.toString() }
	}

	async getChatConfigs(principal: AuthenticatedPrincipal): Promise<ChatConfig[]> {
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)

		if (canViewAllChatConfigs(principal, APP_CONFIG.APP_ROLES)) {
			return (await collection.find({}).toArray()).map((config) => ({ ...config, _id: config._id.toString() }))
		}

		const query: Filter<DbChatConfig> = {
			$or: [
				{ type: "private", "created.by.id": principal.userId },
				{ type: "published", $or: [{ accessGroups: "all" }, { accessGroups: { $in: principal.groups } }] }
			]
		}

		const chatConfigs = await collection.find(query).toArray()
		return chatConfigs.map((config) => ({ ...config, _id: config._id.toString() }))
	}

	async getChatConfigsByVendorAgentId(vendorAgentId: string): Promise<ChatConfig[]> {
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		if (!vendorAgentId) {
			return []
		}
		const chatConfigs = await collection.find({ "vendorAgent.id": vendorAgentId }).toArray()
		return chatConfigs.map((config) => ({ ...config, _id: config._id.toString() }))
	}

	async createChatConfig(chatConfig: NewChatConfig): Promise<ChatConfig> {
		const db = await this.getDb()
		const collection: Collection<NewChatConfig> = db.collection(this.collectionName)
		const result = await collection.insertOne(chatConfig)
		return { ...chatConfig, _id: result.insertedId.toString() }
	}

	async replaceChatConfig(configId: string, chatConfig: ChatConfig): Promise<ChatConfig> {
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		await collection.replaceOne({ _id: new ObjectId(configId) }, chatConfig)
		return { ...chatConfig, _id: configId }
	}

	async deleteChatConfig(configId: string): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		await collection.deleteOne({ _id: new ObjectId(configId) })
	}
}
