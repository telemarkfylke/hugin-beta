import { env } from "$env/dynamic/private";
import { mockConversations } from "$lib/db/mockdb.js";
import { ObjectId } from "mongodb";

const mockC = [
  {
    _id: 'conversation1',
    name: 'Conversation One',
    assistantId: 'assistant1',
    description: 'This is the first conversation.',
    relatedConversationId: 'conversation1-id'
  }
]

/**
 * 
 * @param {string} conversationId 
 * @returns {notImplemented}
 */
export const getConversation = async (conversationId) => {
  if (env.MOCK_DB === 'true') {
    const foundConversation = mockConversations.find(conversation => conversation._id === conversationId);
    if (!foundConversation) {
      throw new Error('Conversation not found');
    }
    return foundConversation;
  }
  // Implement real DB fetch here
}

/**
 * 
 * @param {string} assistantId
 * @param {*} conversation 
 * @returns {notImplemented}
 */
export const insertConversation = async (assistantId, conversation) => {
  if (env.MOCK_DB === 'true') {
    const coversationToInsert = {
      _id: new ObjectId().toString(),
      assistantId,
      ...conversation
    }
    mockConversations.push(coversationToInsert);
    return coversationToInsert;
  }
  // Implement real DB insert here
}
