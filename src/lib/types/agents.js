import z from "zod";

// MOCK

const MockAgentConfig = z.object({
  // Ingen spesifikke felt for mock-agent foreløpig
});

// MISTRAL

/** @typedef {z.infer<typeof MistralDocumentLibraryTool>} MistralDocumentLibraryTool */
const MistralDocumentLibraryTool = z.object({
  type: z.literal('document_library'),
  libraryIds: z.array(z.string())
});

/** @typedef {z.infer<typeof MistralWebSearchTool>} MistralWebSearchTool */
const MistralWebSearchTool = z.object({
  type: z.literal('web_search')
});

/** @typedef {z.infer<typeof MistralAgentConfig>} MistralAgentConfig */
const MistralAgentConfig = z.object({
  agentId: z.string()
});

/** @typedef {z.infer<typeof MistralConversationConfig>} MistralConversationConfig */
export const MistralConversationConfig = z.object({
  agentId: z.string().optional(),
  model: z.enum(['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']).optional(),
  instructions: z.string().default('You are a helpful assistant.').optional(),
  tools: z.array(z.union([MistralDocumentLibraryTool, MistralWebSearchTool])).optional()
});

// OPENAI

/** @typedef {z.infer<typeof OpenAIAgentPrompt>} OpenAIAgentPrompt */
export const OpenAIAgentPrompt = z.object({
  prompt: z.object({
    id: z.string(),
    version: z.string().optional(),
  })
});

/** @typedef {z.infer<typeof AgentConfig>} */
export const AgentConfig = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mock-agent"), ...MockAgentConfig.shape }),
  z.object({ type: z.literal("mistral-conversation"), ...MistralConversationConfig.shape }),
  z.object({ type: z.literal("openai-prompt"), ...OpenAIAgentPrompt.shape })
  // Legg til flere agent konfigurasjonstyper her etter behov
]);

/** @typedef {z.infer<typeof Agent>} */
export const Agent = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: AgentConfig,
});

/** @typedef {z.infer<typeof Agents>} Agents */
export const Agents = z.array(Agent)

/** @typedef {z.infer<typeof Conversation>} */
export const Conversation = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  relatedConversationId: z.string(), // id fra leverandør (Mistral/OpenAI)
});

/** @typedef {z.infer<typeof Conversations>} Conversations */
export const Conversations = z.array(Conversation)
