import z from "zod";

export const MockAgentConfig = z.object({
  // Ingen spesifikke felt for mock-agent foreløpig
});

/** @typedef {z.infer<typeof MistralAgentConfig>} MistralAgentConfig */
export const MistralAgentConfig = z.object({
  agentId: z.string()
});

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
  z.object({ type: z.literal("mistral-agent"), ...MistralAgentConfig.shape }),
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
