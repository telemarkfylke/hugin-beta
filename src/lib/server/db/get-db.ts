import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { MockChatConfigStore } from "./mock-db"
import { MongoChatConfigStore } from "./mongo-db"

let chatConfigStore: IChatConfigStore
if (env.MOCK_DB === "true") {
	chatConfigStore = new MockChatConfigStore()
} else {
	if (!env.MONGODB_CONNECTION_STRING) {
		throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
	}
	const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING)
	chatConfigStore = new MongoChatConfigStore(mongoClient)
}

export const getChatConfigStore = (): IChatConfigStore => {
	return chatConfigStore
}
