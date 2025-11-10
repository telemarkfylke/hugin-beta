import { env } from "$env/dynamic/private";
import type { Conversation } from "$lib/types/agents.ts";
import { ObjectId } from "mongodb";

let mockDbData = null

if (env.MOCK_DB === 'true') {
  const { getMockDb } = await import('$lib/db/mockdb.js');
  mockDbData = await getMockDb();
  console.log(mockDbData)
}

export const getConversation = async (conversationId: string): Promise<Conversation> => {
  if (mockDbData) {
    const foundConversation = mockDbData.conversations.find(conversation => conversation._id === conversationId);
    if (!foundConversation) {
      throw new Error('Conversation not found');
    }
    return foundConversation;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB fetch here
}


type ConversationData = {
  name: string
  description: string
  relatedConversationId: string,
  userLibraryId?: string | null
}

export const insertConversation = async (agentId: string, conversationData: ConversationData): Promise<Conversation> => {
  if (mockDbData) {
    const coversationToInsert = {
      _id: new ObjectId().toString(),
      agentId,
      ...conversationData
    }
    mockDbData.conversations.push(coversationToInsert);
    return coversationToInsert;
  }
  throw new Error('Not implemented - please set MOCK_DB to true in env');
  // Implement real DB insert here
}
