import type { ChatHistory, ChatResponseObject } from "$lib/types/chat";
import type { Db, MongoClient } from "mongodb";
import { MongoConversationStore } from "./adapters/conversation-store";
import type { IConversationStore } from "./adapters/interface";
import type { AuthenticatedPrincipal } from "$lib/types/authentication";
import type { ConversationMessagePair, NewConversationMessagePair } from "../types";
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
		const messages = await this.converationStore.getConversationMessages(conversatonId, null, null, principal)
		for(const messagePair of messages){
			result.push( messagePair.userInput)
			result.push( messagePair.response)
		}
		return result
	}

	public async appendConversationMessage(conversatonId: string, userInput:ChatInputItem, response:ChatResponseObject , principal: AuthenticatedPrincipal):Promise<ConversationMessagePair> {
		const pair: NewConversationMessagePair = {
			userInput:userInput,
			response:response,
			owner:principal.userId,
			includedInSummary:false,
			timestamp:new Date,
			conversationId:conversatonId		
		}
		return await this.converationStore.appendConversationMessage(conversatonId,pair,principal)
	}

	
	
}