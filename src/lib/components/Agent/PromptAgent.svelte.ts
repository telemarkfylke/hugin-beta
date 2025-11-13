// Keeps track of the entire state of an agent component (async stuff are allowed here)
import { parseSse } from "$lib/streaming.js";

const createConversation = async (agentId: string, userPrompt: string): Promise<Response> => {
  return await fetch(`/api/agents/${agentId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ prompt: userPrompt, stream: true })
  });
};

const appendMessageToConversation = async (agentId: string, conversationId: string, userPrompt: string): Promise<Response> => {
  return await fetch(`/api/agents/${agentId}/conversations/${conversationId}`, {
    method: "POST",
    body: JSON.stringify({ prompt: userPrompt, stream: true })
  });
};

export const promptAgent = async (userPrompt: string, agentId: string, conversationId: string | null, setCurrentConversationId: (id: string) => void, addAgentMessageToConversation: (messageId: string, content: string) => void): Promise<void> => {
  if (!agentId) {
    throw new Error("Agent ID is not set");
  }
  if (!userPrompt || userPrompt.trim() === '') {
    throw new Error("User prompt is empty"); // or just return?
  }
  const response = conversationId ? await appendMessageToConversation(agentId, conversationId, userPrompt) : await createConversation(agentId, userPrompt);
  if (!response || !response.ok) {
    throw new Error(`Failed when prompting agent: ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Failed to get a response body from agent prompt");
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  while (true) {
    const { value, done } = await reader.read()
    const chatResponseText = decoder.decode(value, { stream: true })
    const chatResponse = parseSse(chatResponseText)
    for (const chatResult of chatResponse) {
      switch (chatResult.event) {
        case 'conversation.started':
          const { conversationId } = chatResult.data
          setCurrentConversationId(conversationId)
          console.log("Conversation started with ID:", conversationId)
          break;
        /*
        case 'conversation.vectorstore.created':
          const { vectorStoreId } = chatResult.data
          conversation.vectorStoreId = vectorStoreId
          console.log("Vector store created with ID:", vectorStoreId)
          break;
        */
        case 'conversation.message.delta':
          const { messageId, content } = chatResult.data
          addAgentMessageToConversation(messageId, content)
          break;
        default:
          console.warn("Unhandled chat result event:", chatResult.event)
          break;
      }
    }
    if (done) break
  }
}



