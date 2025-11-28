// Keeps track of the entire state of an agent component (async stuff are allowed here)
import type { AddConversationVectorStoreFiles, AddConversationVectorStoreFileToState, AgentState, AgentStateHandler, ClearConversation, GetAgentInfo, GetConversationVectorStoreFileContent, LoadAgentConversation, RemoveConversationVectorStoreFile, RemoveConversationVectorStoreFileFromState, UpdateConversationVectorStoreFileStatusInState } from "$lib/types/agent-state"
import type { DBAgent, Message } from "$lib/types/agents.js"
import type { VectorStoreFile, VectorStoreFileStatus } from "$lib/types/requests.js"
import { getAgentConversation, getAgentConversations } from "./AgentConversations.svelte.js"
import { promptAgent } from "./PromptAgent.svelte.js"
import { deleteConversationVectorStoreFile, getConversationVectorStoreFiles, uploadFilesToConversationVectorStore } from "./AgentConversationVectorStoreFiles.svelte.js"

// DO NOT set agentState (dont pass it, pass methods) directly from outside this file, always use the provided methods to modify it (to keep it consistent and simpler to understand how changes to state happen)
export const createAgentState = (): AgentStateHandler => {
	const agentState: AgentState = $state({
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
	})
	const clearConversation: ClearConversation = () => {
		agentState.currentConversation = {
			isLoading: false,
			error: null,
			value: {
				id: null,
				name: null,
				messages: {},
				vectorStoreFiles: [] // Or the ones connected to the agent by default?
			}
		}
	}

	const getAgentInfo: GetAgentInfo = async () => {
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
				const data: { agent: DBAgent } = await response.json()
				agentState.agentInfo.value = data.agent
			}
		} catch (error) {
			console.error("Error fetching agent info:", error)
			agentState.agentInfo.error = (error as Error).message
			agentState.agentInfo.value = null
		}
		agentState.agentInfo.isLoading = false
	}

	const loadAgentConversations: () => Promise<void> = async () => {
		if (!agentState.agentId) {
			throw new Error("agentId is required to fetch conversations")
		}
		agentState.conversations.isLoading = true
		agentState.conversations.error = null
		try {
			const agentConversations = await getAgentConversations(agentState.agentId)
			agentState.conversations.value = agentConversations.conversations
		} catch (error) {
			agentState.conversations.error = (error as Error).message
		}
		agentState.conversations.isLoading = false
	}

	const loadAgentConversation: LoadAgentConversation = async (conversationId: string) => {
		if (!agentState.agentId || !conversationId) {
			throw new Error("agentId and conversationId are required to fetch conversation")
		}
		agentState.currentConversation.isLoading = true
		agentState.currentConversation.error = null
		try {
			const conversationData = await getAgentConversation(agentState.agentId, conversationId)
			// Set conversation data in state
			agentState.currentConversation.value.id = conversationData.conversation._id
			agentState.currentConversation.value.name = conversationData.conversation.name
			// Map messages to the expected format
			const messagesRecord: Record<string, Message> = {}
			for (const message of conversationData.items) {
				messagesRecord[message.id] = message
			}
			agentState.currentConversation.value.messages = messagesRecord
			getConversationVectorStoreFiles(agentState.agentId, conversationId, addConversationVectorStoreFileToState)
		} catch (error) {
			console.error("Error loading conversation:", error)
			agentState.currentConversation.error = (error as Error).message
		}
		agentState.currentConversation.isLoading = false
	}

	const getConversationVectorStoreFileContent: GetConversationVectorStoreFileContent = (fileId: string) => {
		if (!agentState.agentId || !agentState.currentConversation.value.id) {
			throw new Error("agentId and conversationId are required to get conversation vector store file content")
		}
		try {
			// Fire and forget, we don't need to wait for this to complete here
			fetch(`/api/agents/${agentState.agentId}/conversations/${agentState.currentConversation.value.id}/vectorstorefiles/${fileId}`)
		} catch (error) {
			console.error("Error getting conversation vector store file content:", error)
			agentState.currentConversation.error = (error as Error).message
		}
	}

	/*
	VEd en ny samtale, så er det ingen filer, så da trenger vi ikke å hente no.
	Ved lasting av en eksisterende samtale, så må vi hente filene som hører til den samtalen.
	Ved opplasting av filer, så må vi legge til de nye filene i state også. - eller bare kjøre en refresh hvis vi er late. Men det er ikke poeng å hente inn alle filene på nytt hver gang.
	Ved sletting av filer må vi fjerne filen fra state også.
	*/
	const addConversationVectorStoreFileToState: AddConversationVectorStoreFileToState = (file: VectorStoreFile) => {
		const alreadyExists = agentState.currentConversation.value.vectorStoreFiles.some(f => f.id === file.id)
		if (alreadyExists) {
			console.log(`File with id ${file.id} already exists in current conversation vector store files, skipping add.`)
			return
		}
		agentState.currentConversation.value.vectorStoreFiles.push(file)
	}
	const updateConversationVectorStoreFileStatusInState: UpdateConversationVectorStoreFileStatusInState = (fileId: string, status: VectorStoreFileStatus) => {
		const fileToUpdate = agentState.currentConversation.value.vectorStoreFiles.find(f => f.id === fileId)
		if (fileToUpdate) {
			fileToUpdate.status = status
			return
		}
		throw new Error(`File with id ${fileId} not found in current conversation vector store files`)
	}

	const addConversationVectorStoreFiles: AddConversationVectorStoreFiles = (files: FileList) => {
		if (!agentState.agentId || !agentState.currentConversation.value.id) {
			throw new Error("agentId and conversationId are required to upload files to a conversation")
		}
		try {
			uploadFilesToConversationVectorStore(files, agentState.agentId, agentState.currentConversation.value.id, addConversationVectorStoreFileToState, updateConversationVectorStoreFileStatusInState, addAgentMessageToConversation)
		} catch (error) {
			console.error("Error uploading files:", error)
			agentState.currentConversation.error = (error as Error).message
		}
	}

	const removeConversationVectorStoreFileFromState: (fileId: string) => void = (fileId: string) => {
		agentState.currentConversation.value.vectorStoreFiles = agentState.currentConversation.value.vectorStoreFiles.filter(f => f.id !== fileId)
	}
	const removeConversationVectorStoreFile: RemoveConversationVectorStoreFile = (fileId: string) => {
		if (!agentState.agentId || !agentState.currentConversation.value.id) {
			throw new Error("agentId and conversationId are required to delete conversation vector store file")
		}
		try {
			deleteConversationVectorStoreFile(agentState.agentId, agentState.currentConversation.value.id, fileId, removeConversationVectorStoreFileFromState)
		} catch (error) {
			console.error("Error deleting conversation vector store file:", error)
			agentState.currentConversation.error = (error as Error).message
		}
	}

	const setCurrentConversationId = (conversationId: string) => {
		agentState.currentConversation.value.id = conversationId
	}
	const changeAgent = async (newAgentId: string) => {
		agentState.agentId = newAgentId
		// reset other needed state, and load the new agent's data
		clearConversation()
		loadAgentConversations()
		// Load the new agent's data (maybe set some loading state here?)
		getAgentInfo()
	}
	const addUserMessageToConversation = (messageContent: string) => {
		agentState.currentConversation.value.messages[Date.now().toString()] = {
			role: "user",
			id: Date.now().toString(),
			status: "completed",
			type: "message",
			content: {
				type: "inputText",
				text: messageContent
			}
		}
	}
	const addAgentMessageToConversation = (messageId: string, messageContent: string) => {
		if (!agentState.currentConversation.value.messages[messageId]) {
			agentState.currentConversation.value.messages[messageId] = {
				role: "agent",
				id: messageId,
				status: "in_progress", // TODO handle status updates? and set to completed when done (or error or something)
				type: "message",
				content: {
					type: "outputText",
					text: ""
				}
			}
		}
		agentState.currentConversation.value.messages[messageId].content.text += messageContent
	}
	const postUserPrompt = async (userPrompt: string) => {
		if (!agentState.agentId) {
			throw new Error("Agent ID is not set, you cannot post a prompt without an agentId")
		}
		if (!userPrompt || userPrompt.trim() === "") {
			throw new Error("User prompt is empty, cannot post an empty prompt") // or just return?
		}
		// Reset error state
		agentState.currentConversation.error = null
		// First, add the user message to the conversation immediately
		addUserMessageToConversation(userPrompt)
		// Then, prompt the agent and stream the response
		try {
			await promptAgent(userPrompt, agentState.agentId, agentState.currentConversation.value.id, setCurrentConversationId, addAgentMessageToConversation, loadAgentConversations)
		} catch (error) {
			console.error("Error prompting agent:", error)
			agentState.currentConversation.error = (error as Error).message
		}
	}

	const deleteConversation = (_conversationId: string) => {
		/*
    agentState.conversations.value = agentState.conversations.value.filter(c => c.id !== conversationId);
    if (agentState.currentConversation.value.id === conversationId) {
      clearConversation();
    }
    // And implement db deletion via api, as well as cleanup on provider side
    */
	}

	return {
		get agentState() {
			return agentState
		},
		clearConversation,
		changeAgent,
		getAgentInfo,
		loadAgentConversation,
		deleteConversation,
		addConversationVectorStoreFiles,
		removeConversationVectorStoreFile,
		getConversationVectorStoreFileContent,
		postUserPrompt,
	}
}
