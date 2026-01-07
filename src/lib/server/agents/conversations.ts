import type { DBConversation } from "$lib/types/conversation"
import type { ConversationData } from "../db/conversations/interface"
import { getIocContainer } from "../ioc/container"

const conversationStore = getIocContainer().conversationStore

/*
	Nå ble jo disse veldig tynne, vi må nesten se om det kommer business logikk 
	eller rettighetsjekker o.l seinere som ikke har noe med direkte lagringsteknoligi å gjøre.
	I såfall ville hatt gitt mening å putte inn her, men hvis ikke kan vi vurdere 
	å droppe hele dette laget og bruke IOC containeren direkte.
*/

export const getDBConversations = async (): Promise<DBConversation[]> => {
	return conversationStore.getConversations()
}

export const getDBUserConversations = async (userId: string): Promise<DBConversation[]> => {
	return conversationStore.getUserConversations(userId)
}

export const getDBAgentConversations = async (agentId: string): Promise<DBConversation[]> => {
	return conversationStore.getAgentConversations(agentId)
}

export const getDBAgentUserConversations = async (agentId: string, userId: string): Promise<DBConversation[]> => {
	return conversationStore.getAgentUserConversations(agentId, userId)
}

export const getDBConversation = async (conversationId: string): Promise<DBConversation> => {
	return conversationStore.getConversation(conversationId)
}

export const insertDBConversation = async (agentId: string, conversationData: ConversationData): Promise<DBConversation> => {
	return conversationStore.insertConversation(agentId, conversationData)
}

export const updateDBConversation = async (conversationId: string, updateData: Partial<ConversationData>): Promise<DBConversation> => {
	return conversationStore.updateConversation(conversationId, updateData)
}

export const deleteDBConversation = async (conversationId: string): Promise<void> => {
	return conversationStore.deleteConversation(conversationId)
}
