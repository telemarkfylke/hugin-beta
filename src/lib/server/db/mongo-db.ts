import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import { canViewAllChatConfigs, getUserRoleAccessGroups } from "$lib/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, DbChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { isValidObjectId } from "$lib/validation/object-id"
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
		this.mongoClient = mongoClient
		this.collectionName = "chat-configs"
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
		if (!isValidObjectId(configId)) {
			return null
		}
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

		const roleAccessGroups = getUserRoleAccessGroups(principal, APP_CONFIG.APP_ROLES)

		const query: Filter<DbChatConfig> = {
			$or: [
				{ type: "private", "created.by.id": principal.userId },
				{ type: "published", $or: [{ accessGroups: { $in: roleAccessGroups } }, { "accessGroups.id": { $in: principal.groups } }] }
			]
		}

		const chatConfigs = await collection.find(query).toArray()
		return chatConfigs.map((config) => ({ ...config, _id: config._id.toString() }))
	}

	async createChatConfig(chatConfig: NewChatConfig): Promise<ChatConfig> {
		const db = await this.getDb()
		const collection: Collection<NewChatConfig> = db.collection(this.collectionName)
		const result = await collection.insertOne(chatConfig)
		return { ...chatConfig, _id: result.insertedId.toString() }
	}

	async replaceChatConfig(configId: string, chatConfig: NewChatConfig): Promise<ChatConfig> {
		if (!isValidObjectId(configId)) {
			throw new Error("Invalid ObjectId")
		}
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		const result = await collection.replaceOne({ _id: new ObjectId(configId) }, chatConfig)
		if (result.matchedCount === 0) {
			throw new HTTPError(404, "Chat config not found or was deleted before update could complete")
		}
		return { ...chatConfig, _id: configId }
	}

	async deleteChatConfig(configId: string): Promise<void> {
		if (!isValidObjectId(configId)) {
			throw new Error("Invalid ObjectId")
		}
		const db = await this.getDb()
		const collection: Collection<DbChatConfig> = db.collection(this.collectionName)
		await collection.deleteOne({ _id: new ObjectId(configId) })
	}
}
