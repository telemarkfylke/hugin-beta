import type { DBConversation } from "$lib/types/conversation"

export type ConversationData = Omit<DBConversation, "agentId" | "_id" | "messages"> // messages optional on insert

export interface IConversationStore {
	getConversations(): Promise<DBConversation[]>
	getUserConversations(userId: string): Promise<DBConversation[]>
	getAgentConversations(agentId: string): Promise<DBConversation[]>
	getAgentUserConversations(agentId: string, userId: string): Promise<DBConversation[]>
	getConversation(conversationId: string): Promise<DBConversation>
	insertConversation(agentId: string, conversationData: ConversationData): Promise<DBConversation>
	updateConversation(conversationId: string, updateData: Partial<ConversationData>): Promise<DBConversation>
	deleteConversation(conversationId: string): Promise<void>
}
