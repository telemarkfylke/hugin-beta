// Keeps track of the entire state of an agent component (async stuff are allowed here)
import { parseSse } from "$lib/streaming.js"
import type { AddConversationVectorStoreFileToState, RemoveConversationVectorStoreFileFromState, UpdateConversationVectorStoreFileStatusInState } from "$lib/types/agent-state"
import { GetVectorStoreFilesResult, type VectorStoreFile } from "$lib/types/requests"

export const getConversationVectorStoreFiles = async (agentId: string, conversationId: string, addConversationVectorStoreFileToState: AddConversationVectorStoreFileToState): Promise<void> => {
	if (!agentId || !conversationId) {
		throw new Error("agentId and conversationId are required to fetch conversation vector store files")
	}
	const filesResponse = await fetch(`/api/agents/${agentId}/conversations/${conversationId}/vectorstorefiles`)
	if (!filesResponse.ok) {
		throw new Error(`HTTP error! status: ${filesResponse.status}`)
	}
	const getVectorStoreFilesResult: GetVectorStoreFilesResult = await filesResponse.json()

	GetVectorStoreFilesResult.parse(getVectorStoreFilesResult) // Validate response

	for (const file of getVectorStoreFilesResult.files) {
		addConversationVectorStoreFileToState(file)
	}
}

export const deleteConversationVectorStoreFile = async (
	agentId: string,
	conversationId: string,
	fileId: string,
	removeConversationVectorStoreFileFromState: RemoveConversationVectorStoreFileFromState
) => {
	if (!agentId || !conversationId) {
		throw new Error("agentId and conversationId are required to delete conversation vector store file")
	}
	const deleteResponse = await fetch(`/api/agents/${agentId}/conversations/${conversationId}/vectorstorefiles/${fileId}`, {
		method: "DELETE"
	})
	if (!deleteResponse.ok) {
		throw new Error(`HTTP error! status: ${deleteResponse.status}`)
	}
	removeConversationVectorStoreFileFromState(fileId)
}

const postFilesToConversationVectorStore = async (files: FileList, agentId: string, conversationId: string): Promise<Response> => {
	const formData = new FormData()
	formData.append("stream", "true") // assuming we want always want streaming in frontend
	for (let i = 0; i < files.length; i++) {
		formData.append("files[]", files[i] as File)
	}
	return await fetch(`/api/agents/${agentId}/conversations/${conversationId}/vectorstorefiles`, {
		method: "POST",
		body: formData
	})
}

export const uploadFilesToConversationVectorStore = async (
	files: FileList,
	agentId: string,
	conversationId: string | null,
	addConversationVectorStoreFileToState: AddConversationVectorStoreFileToState,
	updateConversationVectorStoreFileStatusInState: UpdateConversationVectorStoreFileStatusInState,
	addAgentMessageToConversation: (messageId: string, content: string) => void
): Promise<void> => {
	if (!files || files.length === 0) {
		throw new Error("No files provided for upload")
	}
	if (!agentId || !conversationId) {
		throw new Error("agentId and conversationId are required to upload files to a conversation")
	}
	// OBS mulig vi vil støtte opplasting uten conversationId også senere? TODO, sjekk om det skal gjøres her, eller i AgentState eller i API.
	const response = await postFilesToConversationVectorStore(files, agentId, conversationId)
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`)
	}
	if (!response.body) {
		throw new Error("Response body is null")
	}
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
						size: 0, // Size is unknown at this point, need to return it somehow from backend
						summary: null,
						status: "processing"
					}
					addConversationVectorStoreFileToState(vectorStoreFile)
					addAgentMessageToConversation(`${fileId}-msg`, `File "${fileName}" uploaded successfully. Processing...`) // Temporary message, må finne på noe penere
					break
				}
				case "conversation.vectorstore.files.processed": {
					const { files } = uploadResult.data
					console.log("Files processed:", files.map((file) => file.fileId).join(", "))
					for (const file of files) {
						updateConversationVectorStoreFileStatusInState(file.fileId, "ready")
					}
					addAgentMessageToConversation(`${files.map((file) => file.fileId).join(", ")}-msg`, `Files processed successfully.`) // Temporary message, må finne på noe penere
					break
				}
				default:
					console.warn("Unhandled upload result event:", uploadResult)
					break
			}
		}
		if (done) break
	}
}
