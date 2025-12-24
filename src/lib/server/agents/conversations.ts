import { ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { DBConversation } from "$lib/types/conversation"

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
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB insert here
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
		const index = mockDbData.conversations.findIndex((conversation) => conversation._id === conversationId)
		if (index === -1) {
			throw new Error(`Conversation ${conversationId} not found`)
		}
		mockDbData.conversations.splice(index, 1)
		return
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB delete here
}
