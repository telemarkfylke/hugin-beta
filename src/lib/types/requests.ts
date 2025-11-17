import z from "zod";
import { Conversation, Message } from "./agents";

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


export const GetConversationResult = z.object({
  conversation: Conversation,
  items: z.array(Message)
});

export type GetConversationResult = z.infer<typeof GetConversationResult>;

export const GetConversationsResult = z.object({
  conversations: z.array(Conversation)
});

export type GetConversationsResult = z.infer<typeof GetConversationsResult>;
