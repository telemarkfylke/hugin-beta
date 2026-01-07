import { ObjectId } from "mongodb"
import type { DBConversation } from "$lib/types/conversation"
import type { ConversationData, IConversationStore } from "./interface"

export class MockConversationStore implements IConversationStore {
	private conversations: DBConversation[] = []

	constructor(initData?: DBConversation[]) {
		if (initData) {
			this.conversations.push(...initData)
		}
	}

	async getConversations(): Promise<DBConversation[]> {
		return this.conversations
	}

	async getUserConversations(userId: string): Promise<DBConversation[]> {
		const foundConversations = this.conversations.filter((conversation) => conversation.owner.objectId === userId)
		return foundConversations
	}

	async getAgentConversations(agentId: string): Promise<DBConversation[]> {
		const foundConversations = this.conversations.filter((conversation) => conversation.agentId === agentId)
		return foundConversations
	}

	async getAgentUserConversations(agentId: string, userId: string): Promise<DBConversation[]> {
		const foundConversations = this.conversations.filter((conversation) => conversation.agentId === agentId && conversation.owner.objectId === userId)
		return foundConversations
	}

	async getConversation(conversationId: string): Promise<DBConversation> {
		const foundConversation = this.conversations.find((conversation) => conversation._id === conversationId)
		if (!foundConversation) {
			throw new Error("Conversation not found")
		}
		return foundConversation
	}

	async insertConversation(agentId: string, conversationData: ConversationData): Promise<DBConversation> {
		const coversationToInsert = {
			_id: new ObjectId().toString(),
			agentId,
			messages: [],
			...conversationData
		}
		this.conversations.push(coversationToInsert)
		return coversationToInsert
	}

	async updateConversation(conversationId: string, updateData: Partial<ConversationData>): Promise<DBConversation> {
		const foundConversation = this.conversations.find((conversation) => conversation._id === conversationId)
		if (!foundConversation) {
			throw new Error("Conversation not found")
		}
		for (const key in updateData) {
			// @ts-expect-error JUST MOCK DATA ANYWAYS
			foundConversation[key] = updateData[key]
		}
		return foundConversation
	}

	async deleteConversation(conversationId: string): Promise<void> {
		this.conversations = this.conversations.filter((conversation) => conversation._id !== conversationId)
		return
	}
}
