import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { MongoConversationStore } from "$lib/conversationstore/server/adapters/conversation-store"
import type { IConversationStore } from "$lib/conversationstore/server/adapters/interface"
import { MockConversationStore } from "$lib/conversationstore/server/adapters/mock-conversation-store"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import { MockChatConfigStore } from "./mock-db"
import { MongoChatConfigStore } from "./mongo-db"

let chatConfigStore: IChatConfigStore
let conversationStore: IConversationStore

if (env.MOCK_DB === "true") {
	chatConfigStore = new MockChatConfigStore()
	conversationStore = new MockConversationStore()
} else {
	if (!env.MONGODB_CONNECTION_STRING) {
		throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
	}
	// Shared across all stores below - one connection pool against Mongo, not one per store.
	const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING, { ignoreUndefined: true })
	chatConfigStore = new MongoChatConfigStore(mongoClient)
	conversationStore = new MongoConversationStore(mongoClient, null)
}

export const getChatConfigStore = (): IChatConfigStore => {
	return chatConfigStore
}

export const getConversationStore = (): IConversationStore => {
	return conversationStore
}
