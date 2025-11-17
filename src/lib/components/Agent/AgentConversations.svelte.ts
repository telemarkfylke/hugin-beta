import { GetConversationResult, GetConversationsResult } from "$lib/types/requests";

export const getAgentConversations = async (agentId: string): Promise<GetConversationsResult> => {
  if (!agentId) {
    throw new Error("agentId is required to fetch conversations");
  }
  const fetchConversationsResult = await fetch(`/api/agents/${agentId}/conversations`);
  if (!fetchConversationsResult.ok) {
    throw new Error(`Failed to fetch conversations: ${fetchConversationsResult.status}`);
  }
  const data = await fetchConversationsResult.json();
  return GetConversationsResult.parse(data);
}

export const getAgentConversation = async (agentId: string, conversationId: string): Promise<GetConversationResult> => {
  if (!agentId || !conversationId) {
    throw new Error("agentId and conversationId are required to fetch conversation");
  }
  const fetchConversationResult = await fetch(`/api/agents/${agentId}/conversations/${conversationId}`);
  if (!fetchConversationResult.ok) {
    throw new Error(`Failed to fetch conversation: ${fetchConversationResult.status}`);
  }
  const data = await fetchConversationResult.json();
  console.log("Fetched conversation data:", data);
  return GetConversationResult.parse(data);
}

