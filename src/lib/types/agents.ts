import z from "zod";

// MOCK

const MockAgentConfig = z.object({
  // Ingen spesifikke felt for mock-agent foreløpig
});

// MISTRAL

const MistralDocumentLibraryTool = z.object({
  type: z.literal('document_library'),
  libraryIds: z.array(z.string())
});

const MistralWebSearchTool = z.object({
  type: z.literal('web_search')
});


/** @typedef {z.infer<typeof MistralConversationConfig>} MistralConversationConfig */
export const MistralConversationConfig = z.object({
  agentId: z.string().optional(),
  model: z.enum(['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']).optional(),
  instructions: z.string().default('You are a helpful assistant.').optional(),
  tools: z.array(z.union([MistralDocumentLibraryTool, MistralWebSearchTool])).optional()
});

export type MistralConversationConfig = z.infer<typeof MistralConversationConfig>;

// OPENAI

export const OpenAIAgentPrompt = z.object({
  prompt: z.object({
    id: z.string(),
    version: z.string().optional(),
  })
});

export type OpenAIAgentPrompt = z.infer<typeof OpenAIAgentPrompt>;

export const AgentConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mock-agent"), ...MockAgentConfig.shape }),
  z.object({ type: z.literal("mistral-conversation"), ...MistralConversationConfig.shape }),
  z.object({ type: z.literal("openai-prompt"), ...OpenAIAgentPrompt.shape })
  // Legg til flere agent konfigurasjonstyper her etter behov
]);

export type AgentConfig = z.infer<typeof AgentConfig>;

export const Agent = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: AgentConfig,
});

export type Agent = z.infer<typeof Agent>;

export const Agents = z.array(Agent)

export const Conversation = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  relatedConversationId: z.string(), // id fra leverandør (Mistral/OpenAI)
});

export type Conversation = z.infer<typeof Conversation>;

export const Conversations = z.array(Conversation)
