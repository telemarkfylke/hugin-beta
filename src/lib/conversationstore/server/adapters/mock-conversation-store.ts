import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "../../types"
import type { IConversationStore } from "./interface"

let mockConversations: Conversation[] = []
let mockMessages: ConversationMessagePair[] = []
let mockIdCounter = 1

const nextId = (): string => {
	return String(mockIdCounter++)
}

export class MockConversationStore implements IConversationStore {
	async getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null> {
		return mockConversations.find((c) => c.id === conversationId && c.owner === principal.userId) ?? null
	}

	async getConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]> {
		return mockConversations.filter((c) => c.owner === principal.userId).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
	}

	async createConversation(conversation: NewConversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		const newConversation: Conversation = { ...conversation, id: nextId(), owner: principal.userId }
		mockConversations.push(newConversation)
		return newConversation
	}

	async replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		const existing = mockConversations.find((c) => c.id === conversationId && c.owner === principal.userId)
		if (!existing) {
			throw new Error("Conversation not found")
		}
		Object.assign(existing, conversation, { id: conversationId, owner: principal.userId })
		return existing
	}

	async deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		mockConversations = mockConversations.filter((c) => !(c.id === conversationId && c.owner === principal.userId))
	}

	async updateConversationTitle(conversationId: string, title: string, principal: AuthenticatedPrincipal): Promise<void> {
		const existing = mockConversations.find((c) => c.id === conversationId && c.owner === principal.userId)
		if (existing) {
			existing.title = title
			existing.updatedAt = new Date()
		}
	}

	async appendConversationMessage(conversationId: string, messagePair: NewConversationMessagePair, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> {
		const newPair: ConversationMessagePair = { ...messagePair, id: nextId(), conversationId, owner: principal.userId }
		mockMessages.push(newPair)

		// Keep the conversation's own updatedAt current too, mirroring the real Mongo store.
		const existingConversation = mockConversations.find((c) => c.id === conversationId && c.owner === principal.userId)
		if (existingConversation) {
			existingConversation.updatedAt = new Date()
		}

		return newPair
	}

	async getConversationMessages(conversationId: string, last: number | null, cursor: string | null, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		let messages = mockMessages.filter((m) => m.conversationId === conversationId && m.owner === principal.userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

		if (cursor) {
			const cursorIndex = messages.findIndex((m) => m.id === cursor)
			messages = cursorIndex === -1 ? messages : messages.slice(cursorIndex + 1)
		}
		if (last) {
			messages = messages.slice(0, last)
		}
		return messages.reverse()
	}

	async getUnsummarizedConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		return mockMessages.filter((m) => m.conversationId === conversationId && m.owner === principal.userId && !m.includedInSummary).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
	}

	async deleteConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		mockMessages = mockMessages.filter((m) => !(m.conversationId === conversationId && m.owner === principal.userId))
	}
}
