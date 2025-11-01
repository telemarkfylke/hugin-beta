import { env } from "$env/dynamic/private";
import { ObjectId } from "mongodb";

let mockDbData = null

if (env.MOCK_DB === 'true') {
  const { getMockDb } = await import('$lib/db/mockdb.js');
  mockDbData = await getMockDb();
  console.log(mockDbData)
}

/**
 * 
 * @param {string} conversationId 
 * @returns {notImplemented}
 */
export const getConversation = async (conversationId) => {
  if (mockDbData) {
    const foundConversation = mockDbData.conversations.find(conversation => conversation._id === conversationId);
    if (!foundConversation) {
      throw new Error('Conversation not found');
    }
    return foundConversation;
  }
  // Implement real DB fetch here
}

/**
 * 
 * @param {string} agentId
 * @param {*} conversation 
 * @returns {notImplemented}
 */
export const insertConversation = async (agentId, conversation) => {
  if (mockDbData) {
    const coversationToInsert = {
      _id: new ObjectId().toString(),
      agentId,
      ...conversation
    }
    mockDbData.conversations.push(coversationToInsert);
    return coversationToInsert;
  }
  // Implement real DB insert here
}
