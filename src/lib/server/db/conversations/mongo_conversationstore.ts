import type { DBConversation } from "$lib/types/conversation"
import type { ConversationData, IConversationStore } from "./interface"

export class MongoConversationStore implements IConversationStore {
	async getConversations(): Promise<DBConversation[]> {
		throw new Error("Mongo conversationstore not implemented.")
	}
	async getUserConversations(_userId: string): Promise<DBConversation[]> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async getAgentConversations(_agentId: string): Promise<DBConversation[]> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async getAgentUserConversations(_agentId: string, _userId: string): Promise<DBConversation[]> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async getConversation(_conversationId: string): Promise<DBConversation> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async insertConversation(_agentId: string, _conversationData: ConversationData): Promise<DBConversation> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async updateConversation(_conversationId: string, _updateData: Partial<ConversationData>): Promise<DBConversation> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
	async deleteConversation(_conversationId: string): Promise<void> {
		throw new Error("Mongo conversationstore  not implemented.")
	}
}
