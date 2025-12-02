// Keeps track of the entire state of an agent component (async stuff are allowed here)
import type { AgentState, AgentStateHandler, ReadonlyAgentState } from "$lib/types/agent-state"
import type { Agent } from "$lib/types/agents.js"
import type { AgentPrompt } from "$lib/types/message.js"
import { _getAgentConversation, _getAgentConversations } from "./AgentConversations.svelte.js"
import { _addConversationVectorStoreFiles, _deleteConversationVectorStoreFile } from "./AgentConversationVectorStoreFiles.svelte.js"
import { _promptAgent } from "./PromptAgent.svelte.js"

const initialAgentState: AgentState = {
	agentId: null,
	agentInfo: {
		isLoading: false,
		error: null,
		value: null
	},
	currentConversation: {
		isLoading: false,
		error: null,
		value: {
			id: null,
			name: null,
			messages: {},
			vectorStoreFiles: []
		}
	},
	conversations: {
		isLoading: false,
		error: null,
		value: []
	}
}

const _clearCurrentConversation = (agentState: AgentState): void => {
	agentState.currentConversation = {
		isLoading: false,
		error: null,
		value: {
			id: null,
			name: null,
			messages: {},
			vectorStoreFiles: []
		}
	}
}

const _getAgentInfo = async (agentState: AgentState): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("agentId is required to fetch agent info")
	}
	agentState.agentInfo.isLoading = true
	agentState.agentInfo.error = null
	try {
		const response = await fetch(`/api/agents/${agentState.agentId}`)
		if (!response.ok) {
			console.error(`Failed to fetch agent info: ${response.status}`)
			agentState.agentInfo.error = `Failed to fetch agent info: ${response.status}`
			agentState.agentInfo.value = null
		} else {
			const data: { agent: Agent } = await response.json()
			agentState.agentInfo.value = data.agent
		}
	} catch (error) {
		console.error("Error fetching agent info:", error)
		agentState.agentInfo.error = (error as Error).message
		agentState.agentInfo.value = null
	}
	agentState.agentInfo.isLoading = false
	return
}

export const createAgentState = (): AgentStateHandler => {
	const agentState: AgentState = $state(initialAgentState)

	return {
		get agentState() {
			return agentState as ReadonlyAgentState // Should only be mutated via the handler methods
		},
		promptAgent: (userPrompt: AgentPrompt) => _promptAgent(agentState, userPrompt),
		changeAgent: (newAgentId: string): void => {
			if (!newAgentId) {
				throw new Error("newAgentId is required to change agent")
			}
			if (agentState.agentId === newAgentId) {
				console.log("Agent ID is the same as current, not changing.")
				return
			}
			// Set new agent ID, clear current conversation, and fetch new agent info and conversations
			agentState.agentId = newAgentId
			_clearCurrentConversation(agentState)
			_getAgentInfo(agentState)
			_getAgentConversations(agentState)
		},
		clearCurrentConversation: (): void => _clearCurrentConversation(agentState),
		getAgentInfo: () => _getAgentInfo(agentState),
		getAgentConversation: (conversationId: string) => {
			_getAgentConversation(agentState, conversationId)
		},
		addConversationVectorStoreFiles: (files: FileList) => _addConversationVectorStoreFiles(agentState, files),
		deleteConversationVectorStoreFile: (fileId: string) => _deleteConversationVectorStoreFile(agentState, fileId)
	}
}
