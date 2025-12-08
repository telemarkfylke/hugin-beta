import type { Agent } from "./agents.js"
import type { DBConversation } from "./conversation.js"
import type { DeepReadonly } from "./deep-read-only.js"
import type { AgentPrompt, Message } from "./message.js"
import type { VectorStoreFile } from "./vector-store.js"

type FrontEndError = string | null

type CurrentAgentConversation = {
	isLoading: boolean
	error: FrontEndError
	value: {
		id: string | null
		name: string | null
		messages: Record<string, Message>
		vectorStoreFiles: VectorStoreFile[]
	}
}

export type AgentInfo = {
	isLoading: boolean
	error: FrontEndError
	value: Agent | null
}

// Might be funny to add agent data and user configuration as well later?
export type AgentState = {
	agentId: string | null
	agentInfo: AgentInfo
	currentConversation: CurrentAgentConversation
	conversations: {
		isLoading: boolean
		error: FrontEndError
		value: DBConversation[]
	}
}

export type ReadonlyAgentState = DeepReadonly<AgentState>

// Full handler type
export type AgentStateHandler = {
	readonly agentState: ReadonlyAgentState
	promptAgent: (userPrompt: AgentPrompt) => void
	clearCurrentConversation: () => void
	changeAgent: (newAgentId: string) => void
	getAgentInfo: () => void
	getAgentConversation: (conversationId: string) => void
	addConversationVectorStoreFiles: (files: FileList) => void
	deleteConversationVectorStoreFile: (fileId: string) => void
}
