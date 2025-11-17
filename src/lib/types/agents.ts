// AGENT CONFIG TYPES
// MOCK

export type MockAgentConfig = {
  type: 'mock-agent' // discriminator
  instructions: string | null
  fileSearchEnabled: boolean
  webSearchEnabled: boolean
}

// Tester Mistral CONVERT TO ZOD for validering senere til db
export type MistralConversationConfig = {
  type: 'mistral-conversation' // discriminator
  model: 'mistral-small-latest' | 'mistral-medium-latest' | 'mistral-large-latest' // add more models as needed
  instructions: string | null
  fileSearchEnabled: boolean
  webSearchEnabled: boolean
  documentLibraryIds?: string[] | null
}

export type MistralAgentConfig = {
  type: 'mistral-agent' // discriminator
  agentId: string
}

// OPENAI
export type OpenAIAResponseConfig = {
  type: 'openai-response' // discriminator
  model: 'gpt-4o' // add types we want to support here
  instructions: string | null
  fileSearchEnabled: boolean
  webSearchEnabled: boolean
  vectorStoreIds?: string[] | null
}

export type OpenAIPromptConfig = {
  type: 'openai-prompt' // discriminator
  prompt: {
    id: string,
    version?: string
  }
}

// AGENT UNION TYPE
export type AgentConfig = MockAgentConfig | MistralConversationConfig | MistralAgentConfig | OpenAIAResponseConfig | OpenAIPromptConfig

// AGENT AND CONVERSATION TYPES
export type Agent = {
  _id: string;
  name: string;
  description?: string;
  config: AgentConfig;
}

export type Conversation = {
  _id: string;
  agentId: string;
  name: string;
  description?: string;
  relatedConversationId: string; // id fra leverandør (Mistral/OpenAI)
  vectorStoreId: string | null; // id for vector store knyttet til denne samtalen (for filer bruker laster opp i en conversation)
}

