
import type { AuthenticatedPrincipal } from "../../../types/authentication"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "$lib/conversationstore/types"

export interface IConversationStore {
	// Conversations
	getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null>
	getConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]>
	createConversation(conversation: NewConversation, principal: AuthenticatedPrincipal): Promise<Conversation>
	replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation>
	deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void>	

	// Messages
	appendConversationMessage(conversationId: string, messagePair: NewConversationMessagePair, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> 
	getConversationMessages(conversationId: string, last: number | null, cursor: string | null, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> 
	deleteConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<void>	
	getUnsummarizedConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> 
}
