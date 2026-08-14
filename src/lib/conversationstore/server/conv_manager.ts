import { chatHistoryToInputItems } from "$lib/chat-history"
import { buildUtilityConfig, getUtilityVendor } from "$lib/server/utility-llm"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatHistory, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { OutputText } from "$lib/types/chat-item-content"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "../types"
import type { IConversationStore } from "./adapters/interface"

const TITLE_INSTRUCTION = "Lag en kort, presis tittel (maks 6 ord) som oppsummerer denne samtalen. Svar kun med selve tittelen - ingen anførselstegn, ingen avsluttende punktum, ingen annen tekst."

const extractResponseText = (response: ChatResponseObject): string => {
	return response.outputs
		.flatMap((output) => (output.type === "message.output" ? output.content : []))
		.filter((content): content is OutputText => content.type === "output_text")
		.map((content) => content.text)
		.join("")
}

export class ConversationManager {
	private converationStore: IConversationStore

	constructor(conversationStore: IConversationStore) {
		this.converationStore = conversationStore
	}

	public async generateTitle(conversationId: string, principal: AuthenticatedPrincipal): Promise<string | null> {
		const conversation = await this.converationStore.getConversation(conversationId, principal)
		if (!conversation || conversation.title) {
			return conversation?.title ?? null // Doesn't exist, or already has a title - nothing to do.
		}

		const history = await this.getChatHistoryFromDb(conversationId, principal)
		const lastResponse = [...history].reverse().find((item): item is ChatResponseObject => item.type === "chat_response")
		if (!lastResponse) {
			return null // No response yet to base a title on.
		}

		// Runs on the dedicated small utility model (see $lib/server/utility-llm) rather than
		// whatever vendor/model this conversation itself uses - titling is a small, mechanical
		// summarization task that doesn't need a large/expensive model.
		const titleRequest: ChatRequest = {
			config: buildUtilityConfig(TITLE_INSTRUCTION),
			inputs: chatHistoryToInputItems(history),
			stream: false
		}

		const response = await getUtilityVendor().createChatResponse(titleRequest)
		const title = extractResponseText(response).trim()

		if (!title) {
			return null
		}
		await this.converationStore.updateConversationTitle(conversationId, title, principal)
		return title
	}

	public async generateSummary(_conversationId: number) {
		// need to hook up a llm call here
		// Do this at a later stage
	}

	public async getChatHistoryFromDb(conversatonId: string, principal: AuthenticatedPrincipal): Promise<ChatHistory> {
		const result: ChatHistory = []
		//const conversation = this.converationStore.getConversation(conversatonId, principal)
		const messages = await this.converationStore.getUnsummarizedConversationMessages(conversatonId, principal)
		for (const messagePair of messages) {
			result.push(messagePair.userInput)
			result.push(messagePair.response)
		}
		return result
	}

	public async getOrCreateConversationId(conversatonId: string | null, principal: AuthenticatedPrincipal): Promise<string> {
		if (conversatonId) {
			// Don't trust a client-supplied id blindly - it must actually belong to this principal.
			const existing = await this.converationStore.getConversation(conversatonId, principal)
			if (existing) {
				return conversatonId
			}
		}

		const newConversation: NewConversation = {
			owner: principal.userId,
			createdAt: new Date(),
			updatedAt: new Date()
		}
		const conversation = await this.converationStore.createConversation(newConversation, principal)
		return conversation.id
	}

	public async appendConversationMessage(conversatonId: string | null, userInput: ChatInputItem, response: ChatResponseObject, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> {
		const resolvedConversationId = await this.getOrCreateConversationId(conversatonId, principal)

		const pair: NewConversationMessagePair = {
			userInput: userInput,
			response: response,
			owner: principal.userId,
			includedInSummary: false,
			timestamp: new Date(),
			conversationId: resolvedConversationId
		}
		return await this.converationStore.appendConversationMessage(resolvedConversationId, pair, principal)
	}

	public async listConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]> {
		return await this.converationStore.getConversations(principal)
	}

	public async getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null> {
		return await this.converationStore.getConversation(conversationId, principal)
	}

	public async deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		await this.converationStore.deleteConversationMessages(conversationId, principal)
		await this.converationStore.deleteConversation(conversationId, principal)
	}
}
