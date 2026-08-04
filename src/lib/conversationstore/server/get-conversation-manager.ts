import { MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { ConversationManager } from "./conv_manager"

if (!env.MONGODB_CONNECTION_STRING) {
	throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
}
const mongoClient = new MongoClient(env.MONGODB_CONNECTION_STRING, { ignoreUndefined: true })
const conversationManager = new ConversationManager(mongoClient, null)

export const getConversationManager = (): ConversationManager => {
	return conversationManager
}
