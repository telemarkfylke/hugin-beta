import z from "zod"
import { Conversation } from "./conversation.js"
import { AgentPrompt, Message } from "./message.js"
import { VectorStoreFile } from "./vector-store.js"

export const ConversationRequest = z.object({
	prompt: AgentPrompt,
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

export const GetVectorStoreFilesResult = z.object({
	files: z.array(VectorStoreFile)
})

export type GetVectorStoreFilesResult = z.infer<typeof GetVectorStoreFilesResult>
