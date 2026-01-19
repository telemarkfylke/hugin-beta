import type { Collection, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import type { ChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { canViewAllChatConfigs } from "$lib/authorization"
import { APP_CONFIG } from "../app-config/app-config"

export class MongoChatConfigStore implements IChatConfigStore {
	private collection: Collection<ChatConfig>
	constructor(mongoClient: MongoClient) {
		const db = mongoClient.db(env.MONGO_DB_NAME)
		this.collection = db.collection<ChatConfig>("chat_configs")
	}

	async getChatConfig(configId: string): Promise<ChatConfig | null> {
		return await this.collection.findOne({ _id: configId })
	}
	async getChatConfigs(principal: AuthenticatedPrincipal): Promise<ChatConfig[]> {
		if (canViewAllChatConfigs(principal, APP_CONFIG.APP_ROLES)) {
			return await this.collection.find({}).toArray()
		}
		return await this.collection
			.find({
				$or: [
					{ type: "private", "created.by.id": principal.userId },
					{ type: "published", $or: [
						{ accessGroups: "all" },
						{ accessGroups: { $in: principal.groups } }
					]}
				]
			})
			.toArray()
	}
	async getChatConfigsByVendorAgentId(vendorAgentId: string): Promise<ChatConfig[]> {
		if (!vendorAgentId) {
			return []
		}
		return await this.collection.find({ "vendorAgent.id": vendorAgentId }).toArray()
	}
	async createChatConfig(chatConfig: ChatConfig): Promise<ChatConfig> {
		const result = await this.collection.insertOne(chatConfig, { forceServerObjectId: true })
		return { ...chatConfig, _id: result.insertedId.toString() }
	}
	async replaceChatConfig(configId: string, chatConfig: ChatConfig): Promise<ChatConfig> {
		await this.collection.replaceOne({ _id: configId }, chatConfig)
		return { ...chatConfig, _id: configId }
	}
}
