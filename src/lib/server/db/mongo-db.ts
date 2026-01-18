import type { Collection, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import type { ChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"

export class MongoChatConfigStore implements IChatConfigStore {
	private collection: Collection<ChatConfig>
	constructor(mongoClient: MongoClient) {
		const db = mongoClient.db(env.MONGO_DB_NAME)
		this.collection = db.collection<ChatConfig>("chat_configs")
	}

	async getChatConfig(configId: string): Promise<ChatConfig | null> {
		return await this.collection.findOne({ _id: configId })
	}
	async getChatConfigs(): Promise<ChatConfig[]> {
		return await this.collection.find({}).toArray()
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
