import { env } from "$env/dynamic/private";
import type { ChatConfig } from "$lib/types/chat";
import type { IChatConfigStore } from "$lib/types/db/db-interface";
import { Collection, MongoClient } from "mongodb";


export class MongoChatConfigStore implements IChatConfigStore {
  private collection: Collection<ChatConfig>;
  constructor(mongoClient: MongoClient) {
    const db = mongoClient.db(env.MONGO_DB_NAME);
    this.collection = db.collection<ChatConfig>("chat_configs");
  }

  async getChatConfig(configId: string): Promise<ChatConfig | null> {
    return await this.collection.findOne({ _id: configId });
  }
  async getChatConfigs(): Promise<ChatConfig[]> {
    return await this.collection.find({}).toArray();
  }
  async createChatConfig(chatConfig: ChatConfig): Promise<ChatConfig> {
    const result = await this.collection.insertOne(chatConfig, { forceServerObjectId: true });
    return { ...chatConfig, _id: result.insertedId.toString() };
  }
  async updateChatConfig(configId: string, chatConfigUpdateInput: Partial<ChatConfig>): Promise<ChatConfig> {
    const updatedConfig = await this.collection.findOneAndUpdate(
      { _id: configId },
      { $set: chatConfigUpdateInput },
      { returnDocument: "after" }
    );
    if (!updatedConfig) throw new Error("ChatConfig not found");
    return updatedConfig;
  }
}