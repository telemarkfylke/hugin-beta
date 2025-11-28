import type { Conversation, DBAgent, Message } from "./agents"
import type { VectorStoreFile, VectorStoreFileStatus } from "./requests"

type CurrentAgentConversation = {
	isLoading: boolean
	error: string | null
	value: {
		id: string | null
		name: string | null
		messages: Record<string, Message>
		vectorStoreFiles: VectorStoreFile[]
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

// Methods to modify agent state
export type ClearConversation = () => void
export type ChangeAgent = (newAgentId: string) => Promise<void>
export type GetAgentInfo = () => Promise<void>
export type LoadAgentConversation = (conversationId: string) => Promise<void>
export type PostUserPrompt = (userPrompt: string) => Promise<void>

// Vector store file methods
export type AddConversationVectorStoreFileToState = (file: VectorStoreFile) => void
export type RemoveConversationVectorStoreFileFromState = (fileId: string) => void
export type AddConversationVectorStoreFiles = (files: FileList) => void
export type UpdateConversationVectorStoreFileStatusInState = (fileId: string, status: VectorStoreFileStatus) => void
export type GetConversationVectorStoreFiles = () => Promise<void>
export type RemoveConversationVectorStoreFile = (fileId: string) => void
export type DeleteConversation = (conversationId: string) => void
export type GetConversationVectorStoreFileContent = (fileId: string) => void

// Full handler type
export type AgentStateHandler = {
	readonly agentState: AgentState
	clearConversation: ClearConversation
	changeAgent: ChangeAgent
	getAgentInfo: GetAgentInfo
	loadAgentConversation: LoadAgentConversation
	postUserPrompt: PostUserPrompt
	addConversationVectorStoreFiles: AddConversationVectorStoreFiles
	getConversationVectorStoreFiles: GetConversationVectorStoreFiles
	getConversationVectorStoreFileContent: GetConversationVectorStoreFileContent
	removeConversationVectorStoreFile: RemoveConversationVectorStoreFile
	deleteConversation: DeleteConversation
}
