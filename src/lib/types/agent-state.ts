import type { Conversation, DBAgent, Message } from "./agents"

export type AgentVectorStoreFile = {
	id: string
	name: string
	type: string
	summary: string | null
	size: number
}

type CurrentAgentConversation = {
	isLoading: boolean
	error: string | null
	value: {
		id: string | null
		name: string | null
		messages: Record<string, Message>
		files: AgentVectorStoreFile[]
	}
}

export type AgentInfo = {
	isLoading: boolean
	error: string | null
	value: DBAgent | null
}

// Might be funny to add agent data and user configuration as well later?
export type AgentState = {
	agentId: string | null
	agentInfo: AgentInfo
	currentConversation: CurrentAgentConversation
	conversations: {
		isLoading: boolean
		error: string | null
		value: Conversation[]
	}
}

export type AgentStateHandler = {
	readonly agentState: AgentState
	clearConversation: () => void
	changeAgent: (newAgentId: string) => Promise<void>
	getAgentInfo: () => Promise<void>
	loadAgentConversation: (conversationId: string) => Promise<void>
	postUserPrompt: (userPrompt: string) => Promise<void>
	addKnowledgeFilesToConversation: (files: FileList) => void
	refreshConversationFiles: () => Promise<void>
	deleteKnowledgeFileFromConversation: (fileId: string) => void
	deleteConversation: (conversationId: string) => void
	createAgentFromConversation: () => Promise<void>
}
