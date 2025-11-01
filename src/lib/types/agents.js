import z from "zod";

/** @typedef {z.infer<typeof MyResult>} */
const MyResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("failed"), error: z.string() }),
]);

/** @typedef {z.infer<typeof MyResult>} */
export const MistralAgentConfig = z.object({
  agentId: z.string()
});

/** @typedef {z.infer<typeof MistralAgentConfig>} */
export const OpenAIAgentPrompt = z.object({
  prompt: z.object({
    id: z.string(),
    version: z.string().optional(),
  })
});

/** @typedef {z.infer<typeof AgentConfig>} */
export const AgentConfig = z.discriminatedUnion("type", [
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

/** @type {Agent} */
const testMistralAgent = {
  _id: "agent-123",
  name: "Test Mistral Agent",
  description: "An agent using Mistral configuration",
  config: {
    type: "openai-prompt",
    prompt: {
      id: "pmpt_1234567890abcdef",
      version: "1.0"
    }
  }
};