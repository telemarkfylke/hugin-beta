import { MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { DBConversation } from "$lib/types/conversation"
import type { Message } from "$lib/types/message"
import type { VendorId } from "$lib/types/vendor-ids"
import { getMongoClient } from "../db/mongodb"

let mockDbData = null

if (env.MOCK_DB === "true") {
	const { getMockDb } = await import("$lib/server/db/mockdb.js")
	mockDbData = await getMockDb()
}

export const getDBConversations = async (): Promise<DBConversation[]> => {
	if (mockDbData) {
		return mockDbData.conversations
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBUserConversations = async (userId: string): Promise<DBConversation[]> => {
	if (mockDbData) {
		const foundConversations = mockDbData.conversations.filter((conversation) => conversation.owner.objectId === userId)
		return foundConversations
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgentConversations = async (agentId: string): Promise<DBConversation[]> => {
	if (mockDbData) {
		const foundConversations = mockDbData.conversations.filter((conversation) => conversation.agentId === agentId)
		return foundConversations
	}

	const mongoClient: MongoClient = await getMongoClient()
	const response = await mongoClient.db(env.MONGO_DB).collection('conversations')
	.find().sort({ 'name': 1 }) /*.skip(pageSize * page).limit(pageSize)*/

	const documents = await response.toArray() as unknown as DBConversation[];
	return documents

	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBAgentUserConversations = async (agentId: string, userId: string): Promise<DBConversation[]> => {
	if (mockDbData) {
		const foundConversations = mockDbData.conversations.filter((conversation) => conversation.agentId === agentId && conversation.owner.objectId === userId)
		return foundConversations
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getDBConversation = async (conversationId: string): Promise<DBConversation> => {
	if (mockDbData) {
		const foundConversation = mockDbData.conversations.find((conversation) => conversation._id === conversationId)
		if (!foundConversation) {
			throw new Error("Conversation not found")
		}
		return foundConversation
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

type ConversationData = Omit<DBConversation, "agentId" | "_id" | "messages"> // messages optional on insert

export const insertDBConversation = async (agentId: string, conversationData: ConversationData): Promise<DBConversation> => {
	if (mockDbData) {
		const coversationToInsert = {
			_id: new ObjectId().toString(),
			agentId,
			messages: [],
			...conversationData
		}
		mockDbData.conversations.push(coversationToInsert)
		return coversationToInsert
	}
	//throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB insert here
	const mongoClient: MongoClient = await getMongoClient()
	const doc:any = await mongoClient.db(env.MONGO_DB).collection('conversations').findOne({ _id: agentId as any})
	if (!doc){
		throw new Error("Conversation not found")
	}
	return doc as DBConversation

}

export const updateDBConversation = async (conversationId: string, updateData: Partial<ConversationData>): Promise<DBConversation> => {
	if (mockDbData) {
		const foundConversation = mockDbData.conversations.find((conversation) => conversation._id === conversationId)
		if (!foundConversation) {
			throw new Error("Conversation not found")
		}
		for (const key in updateData) {
			// @ts-expect-error JUST MOCK DATA ANYWAYS
			foundConversation[key] = updateData[key]
		}
		return foundConversation
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB update here
}

export const deleteDBConversation = async (conversationId: string): Promise<void> => {
	if (mockDbData) {
		mockDbData.conversations = mockDbData.conversations.filter((conversation) => conversation._id !== conversationId)
		return
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB delete here
}
