import type { ConversationAttachmentEntry } from "$lib/conversationattachments/types"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "$lib/conversationstore/types"
import type { AuthenticatedPrincipal } from "../../../types/authentication"

export interface IConversationStore {
	// Conversations
	getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null>
	getConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]>
	createConversation(conversation: NewConversation, principal: AuthenticatedPrincipal): Promise<Conversation>
	replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation>
	deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void>
	updateConversationTitle(conversationId: string, title: string, principal: AuthenticatedPrincipal): Promise<void>

	// Attachments stored in S3 - their list (incl. each file's key) lives in the conversation header, but is
	// never part of Conversation: getConversation/getConversations leave it out, only these read/write it.
	/** Appends one entry atomically (safe with concurrent turns). Throws if the conversation doesn't exist for this principal. */
	addConversationAttachment(conversationId: string, entry: ConversationAttachmentEntry, principal: AuthenticatedPrincipal): Promise<void>
	/** Every readable entry, oldest first ([] if the conversation doesn't exist for this principal). */
	getConversationAttachments(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationAttachmentEntry[]>

	// Messages
	appendConversationMessage(conversationId: string, messagePair: NewConversationMessagePair, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair>
	getConversationMessages(conversationId: string, last: number | null, cursor: string | null, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]>
	deleteConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<void>
	getUnsummarizedConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]>
}
