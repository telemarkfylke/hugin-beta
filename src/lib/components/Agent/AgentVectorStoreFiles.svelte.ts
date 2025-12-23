import { parseSse } from "$lib/streaming.js"
import type { AgentState } from "$lib/types/agent-state"
import { GetVendorVectorStoreFilesResponse } from "$lib/types/api-responses"
import type { VectorStoreFile, VectorStoreFileStatus } from "$lib/types/vector-store"

const _addVectorStoreFileToState = (agentState: AgentState, file: VectorStoreFile): void => {
	const alreadyExists = agentState.vectorStoreFiles.some((f) => f.id === file.id)
	if (alreadyExists) {
		console.log(`File with id ${file.id} already exists in current conversation vector store files, skipping add.`)
		return
	}
	agentState.vectorStoreFiles.push(file)
}

const _updateVectorStoreFileStatusInState = (agentState: AgentState, fileId: string, status: VectorStoreFileStatus) => {
	const fileToUpdate = agentState.vectorStoreFiles.find((f) => f.id === fileId)
	if (fileToUpdate) {
		fileToUpdate.status = status
		return
	}
	throw new Error(`File with id ${fileId} not found in current conversation vector store files`)
}

export const _getVectorStoreFiles = async (agentState: AgentState): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("agentId are required to fetch vector store files")
	}
	// Reset error state
	agentState.agentInfo.error = null
	try {
		const filesResponse = await fetch(`/api/agents/${agentState.agentId}/vectorstorefiles`)
		if (!filesResponse.ok) {
			throw new Error(`HTTP error! status: ${filesResponse.status}`)
		}
		// Get json and validate
		const getVectorStoreFilesResult = GetVendorVectorStoreFilesResponse.parse(await filesResponse.json())

		for (const file of getVectorStoreFilesResult.files) {
			_addVectorStoreFileToState(agentState, file)
		}
	} catch (error) {
		console.error("Error fetching vector store files:", error)
		agentState.agentInfo.error = (error as Error).message
	}
}

export const _deleteVectorStoreFile = async (agentState: AgentState, fileId: string): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("agentId  are required to delete conversation vector store file")
	}
	// Reset error state
	agentState.agentInfo.error = null
	try {
		const deleteResponse = await fetch(`/api/agents/${agentState.agentId}/vectorstorefiles/${fileId}`, {
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

export const _addVectorStoreFiles = async (agentState: AgentState, files: FileList): Promise<void> => {
	if (!files || files.length === 0) {
		throw new Error("No files provided for upload")
	}
	if (!agentState.agentId ) {
		throw new Error("agentId are required to upload files to a conversation")
	}
	// Reset error state
	agentState.currentConversation.error = null
	// OBS mulig vi vil støtte opplasting uten conversationId også senere? TODO, sjekk om det skal gjøres her, eller i AgentState eller i API.
	const formData = new FormData()
	formData.append("stream", "true") // assuming we want always want streaming in frontend
	for (let i = 0; i < files.length; i++) {
		formData.append("files[]", files[i] as File)
	}
	const response = await fetch(`/api/agents/${agentState.agentId}/vectorstorefiles`, {
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
					case "agent.vectorstore.file.processed": {
						const { fileId, fileName } = uploadResult.data
						console.log(`File uploaded: ${fileName} (ID: ${fileId})`)
						const vectorStoreFile: VectorStoreFile = {
							id: fileId,
							name: fileName,
							type: "unknown", // Type and size are unknown at this point, need to return it somehow from backend
							bytes: 0, // Size is unknown at this point, need to return it somehow from backend
							summary: null,
							status: "ready"
						}
						_addVectorStoreFileToState(agentState, vectorStoreFile)
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
		console.error("Error uploading files to agent vector store:", error)
		agentState.agentInfo.error = (error as Error).message
	}
}
