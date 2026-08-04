import type { ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { ObjectId } from "mongodb"

export type ConversationMessagePair = {
	id: string
	timestamp: Date
	conversationId: string
	userInput: ChatInputItem
	response: ChatResponseObject
	includedInSummary: boolean
	owner: string
}
export type NewConversation =  Omit<Conversation, "id">

export type Conversation = {
	id: string
	lastUpdated:Date
	owner: string
	userInput: ChatInputItem
	response: ChatResponseObject
	summary: string	
	createdAt:Date
	updatedAt:Date
}
export type NewConversationMessagePair =  Omit<ConversationMessagePair, "id">


