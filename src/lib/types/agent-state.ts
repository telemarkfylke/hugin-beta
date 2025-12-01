import type { Conversation, DBAgent, Message } from "./agents"
import type { AgentPrompt, VectorStoreFile } from "./requests"

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
	value: DBAgent | null
}

// Might be funny to add agent data and user configuration as well later?
export type AgentState = {
	agentId: string | null
	agentInfo: AgentInfo
	currentConversation: CurrentAgentConversation
	conversations: {
		isLoading: boolean
		error: FrontEndError
		value: Conversation[]
	}
}

/**
 * Recursively makes all properties of an object type readonly.
 * @link https://www.geeksforgeeks.org/typescript/how-to-create-deep-readonly-type-in-typescript/
 */
type DeepReadonly<T> = T extends (infer U)[]
	? ReadonlyArray<DeepReadonly<U>>
	: {
			readonly [K in keyof T]: T[K] extends object
				? DeepReadonly<T[K]>
				: // Recursively apply DeepReadonly for nested objects
					T[K]
			// Otherwise, keep the original type
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
