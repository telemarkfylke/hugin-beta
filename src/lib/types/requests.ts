import z from "zod"
import { Conversation, Message } from "./agents"

// Ta alle datagreier som skal mottas enten i frontend eller backend her

/**
 * Schema for creating a new conversation with an agent
 * POST /api/agents/:agentId/conversations
 */
export const ConversationRequest = z.object({
	prompt: z.string().min(1, "Prompt cannot be empty"),
	stream: z.boolean()
})

export type ConversationRequest = z.infer<typeof ConversationRequest>

export const GetConversationResult = z.object({
	conversation: Conversation,
	items: z.array(Message)
})

export type GetConversationResult = z.infer<typeof GetConversationResult>

export const GetConversationsResult = z.object({
	conversations: z.array(Conversation)
})

export type GetConversationsResult = z.infer<typeof GetConversationsResult>

const vectorStoreFileStatusEnum = z.enum(["ready", "processing", "error"])

export type VectorStoreFileStatus = z.infer<typeof vectorStoreFileStatusEnum>

export const VectorStoreFile = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	size: z.number(),
	summary: z.string().nullable().optional(),
	status: vectorStoreFileStatusEnum
})

export type VectorStoreFile = z.infer<typeof VectorStoreFile>

export const GetVectorStoreFilesResult = z.object({
	files: z.array(VectorStoreFile)
})

export type GetVectorStoreFilesResult = z.infer<typeof GetVectorStoreFilesResult>
