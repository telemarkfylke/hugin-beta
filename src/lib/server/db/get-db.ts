import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { MongoConversationStore } from "$lib/conversationstore/server/adapters/conversation-store"
import type { IConversationStore } from "$lib/conversationstore/server/adapters/interface"
import { MockConversationStore } from "$lib/conversationstore/server/adapters/mock-conversation-store"
import { MockRateLimiter } from "$lib/server/rate-limit/mock-rate-limiter"
import { MongoRateLimiter } from "$lib/server/rate-limit/mongo-rate-limiter"
import type { IStatsStore } from "$lib/statsstore/server/adapters/interface"
import { MockStatsStore } from "$lib/statsstore/server/adapters/mock-stats-store"
import { MongoStatsStore } from "$lib/statsstore/server/adapters/stats-store"
import type { IChatConfigStore } from "$lib/types/db/db-interface"
import type { IRateLimiter } from "../rate-limit/interface"
import { MockChatConfigStore } from "./mock-db"
import { MongoChatConfigStore } from "./mongo-db"

let chatConfigStore: IChatConfigStore
let conversationStore: IConversationStore
let statsStore: IStatsStore
let rateLimiter: IRateLimiter

if (env.MOCK_DB === "true") {
	chatConfigStore = new MockChatConfigStore()
	conversationStore = new MockConversationStore()
	statsStore = new MockStatsStore()
	rateLimiter = new MockRateLimiter()
} else {
	if (!env.MONGODB_CONNECTION_STRING) {
		throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
	}
	// Shared across all stores below - one connection pool against Mongo, not one per store.
	const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING, { ignoreUndefined: true })
	chatConfigStore = new MongoChatConfigStore(mongoClient)
	conversationStore = new MongoConversationStore(mongoClient, null)
	statsStore = new MongoStatsStore(mongoClient)
	rateLimiter = new MongoRateLimiter(mongoClient)
}

export const getChatConfigStore = (): IChatConfigStore => {
	return chatConfigStore
}

export const getConversationStore = (): IConversationStore => {
	return conversationStore
}

export const getStatsStore = (): IStatsStore => {
	return statsStore
}

// Swappable backing store (Mongo today, see $lib/server/rate-limit) behind one shared instance -
// same "get the singleton" pattern as the stores above, so a future Redis-backed IRateLimiter is a
// one-line swap here, not a change anywhere it's actually used.
export const getRateLimiter = (): IRateLimiter => {
	return rateLimiter
}
