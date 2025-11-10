import type { ConversationRequest } from "@mistralai/mistralai/models/components";
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses.mjs";

// MOCK

export type MockAgentConfig = {
  type: 'mock-agent' // discriminator
}

// MISTRAL
export type MistralConversationConfig = Omit<ConversationRequest, 'inputs'> & {
  type: 'mistral-conversation' // discriminator
}
// OPENAI
export type OpenAIAResponseConfig = Omit<ResponseCreateParamsBase, 'input'> & {
  type: 'openai-response' // discriminator
}

// AGENT UNION TYPE
export type AgentConfig = MockAgentConfig | MistralConversationConfig | OpenAIAResponseConfig


// AGENT AND CONVERSATION TYPES
export type Agent = {
  _id: string;
  name: string;
  description?: string;
  config: AgentConfig;
}

export type Conversation = {
  _id: string;
  name: string;
  description?: string;
  relatedConversationId: string; // id fra leverandør (Mistral/OpenAI)
  vectorStoreId: string | null; // id for vector store knyttet til denne samtalen (for filer bruker laster opp i en conversation)
}

