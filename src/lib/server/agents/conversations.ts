import { ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { Conversation, Message  } from "$lib/types/agents.ts"


let mockDbData = null

if (env.MOCK_DB === "true") {
	const { getMockDb } = await import("$lib/server/db/mockdb.js")
	mockDbData = await getMockDb()
	console.log(mockDbData)
}

export const getConversations = async (agentId: string): Promise<Conversation[]> => {
	if (mockDbData) {
		const foundConversations = mockDbData.conversations.filter((conversation) => conversation.agentId === agentId)
		return foundConversations
	}
	throw new Error("Not implemented - please set MOCK_DB to true in env")
	// Implement real DB fetch here
}

export const getConversation = async (conversationId: string): Promise<Conversation> => {
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

type ConversationData = {
  name: string
  description: string
  relatedConversationId: string,
  vectorStoreId: string | null,
  messages?:Message[]
}

export const insertConversation = async (agentId: string, conversationData: ConversationData): Promise<Conversation> => {
  if (mockDbData) {
    const coversationToInsert = {
      _id: new ObjectId().toString(),
      agentId,
      messages:[],
      ...conversationData      
    }
    mockDbData.conversations.push(coversationToInsert);
    return coversationToInsert;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB insert here
}

export const updateConversation = async (conversationId: string, updateData: Partial<ConversationData>): Promise<Conversation> => {
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
