// AGENT CONFIG TYPES
// MOCK

import z from "zod";

export const MockAgentConfig = z.object({
  type: z.literal('mock-agent'),
  instructions: z.string().nullable(),
  fileSearchEnabled: z.boolean(),
  webSearchEnabled: z.boolean()
});

export type MockAgentConfig = z.infer<typeof MockAgentConfig>;


// MISTRAL
export const MistralConversationConfig = z.object({
  type: z.literal('mistral-conversation'), // discriminator
  model: z.enum(['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest']), // add models we want to support here
  instructions: z.string().nullable(),
  fileSearchEnabled: z.boolean(),
  webSearchEnabled: z.boolean(),
  documentLibraryIds: z.array(z.string()).nullable().optional()
});

export type MistralConversationConfig = z.infer<typeof MistralConversationConfig>;

export const MistralAgentConfig = z.object({
  type: z.literal('mistral-agent'), // discriminator
  agentId: z.string()
});

export type MistralAgentConfig = z.infer<typeof MistralAgentConfig>;

// OPENAI
/*
export type OpenAIAResponseConfig = Omit<ResponseCreateParamsBase, 'input'> & {
  type: 'openai-response' // discriminator
}
// OPENAI
export type OllamaAIResponseConfig = Omit<ResponseCreateParamsBase, 'input'> & {
  type: 'ollama-response' // discriminator
}

// AGENT UNION TYPE
export type AgentConfig = MockAgentConfig | MistralConversationConfig | OpenAIAResponseConfig | OllamaAIResponseConfig
*/
export const OllamaAIResponseConfig = z.object({
  type: z.literal('ollama-response'), // discriminator
  model: z.enum(['gemma3']),  // add models we want to support here
  instructions: z.string().nullable(),
  fileSearchEnabled: z.boolean(),
  webSearchEnabled: z.boolean(),
  vectorStoreIds: z.array(z.string()).nullable().optional()
});

export type OllamaAIResponseConfig = z.infer<typeof OllamaAIResponseConfig>;

export const OpenAIAResponseConfig = z.object({
  type: z.literal('openai-response'), // discriminator
  model: z.enum(['gpt-4o']),  // add models we want to support here
  instructions: z.string().nullable(),
  fileSearchEnabled: z.boolean(),
  webSearchEnabled: z.boolean(),
  vectorStoreIds: z.array(z.string()).nullable().optional()
});

export type OpenAIAResponseConfig = z.infer<typeof OpenAIAResponseConfig>;

export const OpenAIPromptConfig = z.object({
  type: z.literal('openai-prompt'), // discriminator
  prompt: z.object({
    id: z.string(),
    version: z.string().optional()
  })
});

export type OpenAIPromptConfig = z.infer<typeof OpenAIPromptConfig>;

// AGENT UNION TYPE
export const AgentConfig = z.discriminatedUnion('type', [
  MockAgentConfig,
  MistralConversationConfig,
  MistralAgentConfig,
  OpenAIAResponseConfig,
  OpenAIPromptConfig,
  OllamaAIResponseConfig
]);

export type AgentConfig = z.infer<typeof AgentConfig>;


// AGENT AND CONVERSATION TYPES
export const Agent = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  config: AgentConfig
});

export type Agent = z.infer<typeof Agent>;


// MESSAGE TYPES
export const Message = z.object({
  id: z.string(),
  type: z.enum(['message']),
  status: z.string(),
  role: z.enum(['user', 'agent']), // Legg inn flere ved behov (f. eks developer)
  content: z.object({
    type: z.enum(['inputText', 'outputText']),
    text: z.string()
  })
});

export type Message = z.infer<typeof Message>;

export const Conversation = z.object({
  _id: z.string(),
  agentId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  relatedConversationId: z.string(), // id fra leverandør (Mistral/OpenAI)
  vectorStoreId: z.string().nullable(), // id for vector store knyttet til denne samtalen (for filer bruker laster opp i en conversation)
  messages: z.array(Message) 
});

export type Conversation = z.infer<typeof Conversation>;


export type ConversationMessage = {
  originator: string
  message: string
}



