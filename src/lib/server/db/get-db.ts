import { env } from "$env/dynamic/private";
import type { IChatConfigStore } from "$lib/types/db/db-interface";
import { MongoClient } from "mongodb";
import { MockChatConfigStore } from "./mock-db";
import { MongoChatConfigStore } from "./mongo-db";
import { logger } from "@vestfoldfylke/loglady";

let chatConfigStore: IChatConfigStore
if (env.MOCK_DB === "true") {
  chatConfigStore = new MockChatConfigStore();
} else {
  let mongoClient: MongoClient;
  try {
    mongoClient = new MongoClient(env.MONGO_DB_URI || "");
    await mongoClient.connect();
  } catch (error) {
    logger.errorException(error, "Failed to connect to MongoDB");
    throw error;
  }
  chatConfigStore = new MongoChatConfigStore(mongoClient);
}

export const getChatConfigStore = (): IChatConfigStore => {
  return chatConfigStore;
}