import { parseSse } from "$lib/streaming.js"
import type { AgentState } from "$lib/types/agent-state"
import { GetVendorVectorStoreFilesResponse } from "$lib/types/api-responses"
import type { VectorStoreFile, VectorStoreFileStatus } from "$lib/types/vector-store"

const _addConversationVectorStoreFileToState = (agentState: AgentState, file: VectorStoreFile): void => {
	const alreadyExists = agentState.currentConversation.value.vectorStoreFiles.some((f) => f.id === file.id)
	if (alreadyExists) {
		console.log(`File with id ${file.id} already exists in current conversation vector store files, skipping add.`)
		return
	}
	agentState.currentConversation.value.vectorStoreFiles.push(file)
}

const _updateConversationVectorStoreFileStatusInState = (agentState: AgentState, fileId: string, status: VectorStoreFileStatus) => {
	const fileToUpdate = agentState.currentConversation.value.vectorStoreFiles.find((f) => f.id === fileId)
	if (fileToUpdate) {
		fileToUpdate.status = status
		return
	}
	throw new Error(`File with id ${fileId} not found in current conversation vector store files`)
}

export const _getConversationVectorStoreFiles = async (agentState: AgentState): Promise<void> => {
	if (!agentState.agentId || !agentState.currentConversation.value.id) {
		throw new Error("agentId and currentConversationId are required to fetch conversation vector store files")
	}
	// Reset error state
	agentState.currentConversation.error = null
	try {
		const filesResponse = await fetch(`/api/agents/${agentState.agentId}/conversations/${agentState.currentConversation.value.id}/vectorstorefiles`)
		if (!filesResponse.ok) {
			throw new Error(`HTTP error! status: ${filesResponse.status}`)
		}
		// Get json and validate
		const getVectorStoreFilesResult = GetVendorVectorStoreFilesResponse.parse(await filesResponse.json())

		for (const file of getVectorStoreFilesResult.files) {
			_addConversationVectorStoreFileToState(agentState, file)
		}
	} catch (error) {
		console.error("Error fetching conversation vector store files:", error)
		agentState.currentConversation.error = (error as Error).message
	}
}

export const _deleteConversationVectorStoreFile = async (agentState: AgentState, fileId: string): Promise<void> => {
	if (!agentState.agentId || !agentState.currentConversation.value.id) {
		throw new Error("agentId and conversationId are required to delete conversation vector store file")
	}
	// Reset error state
	agentState.currentConversation.error = null
	try {
		const deleteResponse = await fetch(`/api/agents/${agentState.agentId}/conversations/${agentState.currentConversation.value.id}/vectorstorefiles/${fileId}`, {
			method: "DELETE"
		})
		if (!deleteResponse.ok) {
			throw new Error(`HTTP error! status: ${deleteResponse.status}`)
		}
		agentState.currentConversation.value.vectorStoreFiles = agentState.currentConversation.value.vectorStoreFiles.filter((f) => f.id !== fileId)
	} catch (error) {
		console.error("Error deleting conversation vector store file:", error)
		agentState.currentConversation.error = (error as Error).message
	}
}

export const _addConversationVectorStoreFiles = async (agentState: AgentState, files: FileList): Promise<void> => {
	if (!files || files.length === 0) {
		throw new Error("No files provided for upload")
	}
	if (!agentState.agentId || !agentState.currentConversation.value.id) {
		throw new Error("agentId and conversationId are required to upload files to a conversation")
	}
	// Reset error state
	agentState.currentConversation.error = null
	// OBS mulig vi vil støtte opplasting uten conversationId også senere? TODO, sjekk om det skal gjøres her, eller i AgentState eller i API.
	const formData = new FormData()
	formData.append("stream", "true") // assuming we want always want streaming in frontend
	for (let i = 0; i < files.length; i++) {
		formData.append("files[]", files[i] as File)
	}
	const response = await fetch(`/api/agents/${agentState.agentId}/conversations/${agentState.currentConversation.value.id}/vectorstorefiles`, {
		method: "POST",
		body: formData
	})
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`)
	}
	if (!response.body) {
		throw new Error("Response body is null")
	}
	try {
		const reader = response.body.getReader()
		const decoder = new TextDecoder("utf-8")
		while (true) {
			const { value, done } = await reader.read()
			const chatResponseText = decoder.decode(value, { stream: true })
			const uploadResponse = parseSse(chatResponseText)
			for (const uploadResult of uploadResponse) {
				switch (uploadResult.event) {
					case "conversation.vectorstore.file.uploaded": {
						const { fileId, fileName } = uploadResult.data
						console.log(`File uploaded: ${fileName} (ID: ${fileId})`)
						const vectorStoreFile: VectorStoreFile = {
							id: fileId,
							name: fileName,
							type: "unknown", // Type and size are unknown at this point, need to return it somehow from backend
							bytes: 0, // Size is unknown at this point, need to return it somehow from backend
							summary: null,
							status: "processing"
						}
						_addConversationVectorStoreFileToState(agentState, vectorStoreFile)
						break
					}
					case "conversation.vectorstore.files.processed": {
						const { files } = uploadResult.data
						console.log("Files processed:", files.map((file) => file.fileId).join(", "))
						for (const file of files) {
							_updateConversationVectorStoreFileStatusInState(agentState, file.fileId, "ready")
						}
						break
					}
					default:
						console.warn("Unhandled upload result event:", uploadResult)
						break
				}
			}
			if (done) break
		}
	} catch (error) {
		console.error("Error uploading files to conversation vector store:", error)
		agentState.currentConversation.error = (error as Error).message
	}
}
