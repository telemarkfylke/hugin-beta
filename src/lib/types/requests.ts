import z from "zod"
import { DBConversation } from "./conversation.js"
import { AgentPrompt, Message } from "./message.js"

export const ConversationRequest = z.object({
	prompt: AgentPrompt,
	stream: z.boolean()
})

export type ConversationRequest = z.infer<typeof ConversationRequest>

export const GetConversationResult = z.object({
	conversation: DBConversation,
	items: z.array(Message)
})

export type GetConversationResult = z.infer<typeof GetConversationResult>

export const GetConversationsResult = z.object({
	conversations: z.array(DBConversation)
})

export type GetConversationsResult = z.infer<typeof GetConversationsResult>
