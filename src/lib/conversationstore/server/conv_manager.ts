import type { ChatHistory, ChatResponseObject } from "$lib/types/chat";
import type { Db, MongoClient } from "mongodb";
import { MongoConversationStore } from "./adapters/conversation-store";
import type { IConversationStore } from "./adapters/interface";
import type { AuthenticatedPrincipal } from "$lib/types/authentication";
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "../types";
import type { ChatInputItem } from "$lib/types/chat-item";

export class ConversationManager {

	private converationStore:IConversationStore
	
	constructor(mongoClient: MongoClient, mongoDb: Db | null){
		this.converationStore = new MongoConversationStore(mongoClient, mongoDb) 
	}

	public async generateSummary(conversationId: number){
		// need to hook up a llm call here
		// Do this at a later stage
	}

	public async getChatHistoryFromDb(conversatonId: string, principal: AuthenticatedPrincipal):Promise<ChatHistory> {
		const result:ChatHistory = []
		//const conversation = this.converationStore.getConversation(conversatonId, principal)
		const messages = await this.converationStore.getUnsummarizedConversationMessages(conversatonId, principal)
		for(const messagePair of messages){
			result.push( messagePair.userInput)
			result.push( messagePair.response)
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

	public async appendConversationMessage(conversatonId: string | null, userInput:ChatInputItem, response:ChatResponseObject , principal: AuthenticatedPrincipal):Promise<ConversationMessagePair> {
		const resolvedConversationId = await this.getOrCreateConversationId(conversatonId, principal)

		const pair: NewConversationMessagePair = {
			userInput:userInput,
			response:response,
			owner:principal.userId,
			includedInSummary:false,
			timestamp:new Date,
			conversationId:resolvedConversationId
		}
		return await this.converationStore.appendConversationMessage(resolvedConversationId,pair,principal)
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