import z from "zod";

// Ta alle datagreier som skal mottas enten i frontend eller backend her

/**
 * Schema for creating a new conversation with an agent
 * POST /api/agents/:agentId/conversations
 */
export const ConversationRequest = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  stream: z.boolean()
});

export type ConversationRequest = z.infer<typeof ConversationRequest>;