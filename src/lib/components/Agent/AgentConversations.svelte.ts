import type { AgentState } from "$lib/types/agent-state"
import type { Message } from "$lib/types/message.js"
import { GetConversationResult, GetConversationsResult } from "$lib/types/requests.js"
import { _getConversationVectorStoreFiles } from "./AgentConversationVectorStoreFiles.svelte.js"

// Internal method to update agent state with conversations, only to be used as internal function	in AgentState.svelte.ts
export const _getAgentConversations = async (agentState: AgentState): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("agentId is required to fetch conversations")
	}
	agentState.conversations.isLoading = true
	agentState.conversations.error = null
	try {
		const fetchConversationsResult = await fetch(`/api/agents/${agentState.agentId}/conversations`)
		if (!fetchConversationsResult.ok) {
			throw new Error(`Failed to fetch conversations: ${fetchConversationsResult.status}`) // Hm bad
		}
		const data = await fetchConversationsResult.json()
		agentState.conversations.value = GetConversationsResult.parse(data).conversations
	} catch (error) {
		agentState.conversations.error = (error as Error).message
	}
	agentState.conversations.isLoading = false
}

export const _getAgentConversation = async (agentState: AgentState, conversationId: string): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("agentId is required to fetch conversation")
	}
	if (!conversationId) {
		throw new Error("conversationId is required to fetch conversation")
	}
	agentState.currentConversation.isLoading = true
	agentState.currentConversation.error = null
	try {
		const fetchConversationResult = await fetch(`/api/agents/${agentState.agentId}/conversations/${conversationId}`)
		if (!fetchConversationResult.ok) {
			throw new Error(`Failed to fetch conversation: ${fetchConversationResult.status}`)
		}
		const data = await fetchConversationResult.json()
		const conversationData = GetConversationResult.parse(data)
		// Set conversation data in state
		agentState.currentConversation.value.id = conversationData.conversation._id
		agentState.currentConversation.value.name = conversationData.conversation.name
		// Map messages to the expected format
		const messagesRecord: Record<string, Message> = {}
		for (const message of conversationData.items) {
			messagesRecord[message.id] = message
		}
		agentState.currentConversation.value.messages = messagesRecord
		if (conversationData.conversation.vectorStoreId) {
			_getConversationVectorStoreFiles(agentState)
		}
	} catch (error) {
		console.error("Error loading conversation:", error)
		agentState.currentConversation.error = (error as Error).message
	}
	agentState.currentConversation.isLoading = false
}
