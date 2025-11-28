import { json, redirect, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getConversation } from "$lib/server/agents/conversations"

export const GET: RequestHandler = async ({ params }) => {
	// Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
	const { conversationId, agentId, fileId } = params
	if (!agentId || !conversationId || !fileId) {
		return json({ error: "agentId, conversationId, and fileId are required" }, { status: 400 })
	}

	const dbAgent = await getDBAgent(agentId)

	if (!dbAgent.config.fileSearchEnabled) {
		return json({ error: "File upload is not enabled for this agent" }, { status: 403 })
	}

	const conversation = await getConversation(conversationId)
	//	TODO: validate that conversation belongs to agentId and that user has access to it

	const agent = createAgent(dbAgent)

	let fileResponse: string | unknown
	try {
		fileResponse = await agent.getConversationVectorStoreFileContent(conversation, fileId)
		// Return the file as a downloadable url or blob or something
	} catch (error) {
		throw new Error(`Failed to get vector store file content: ${(error as Error).message}`)
	}
	if (typeof fileResponse === "string") {
		console.log("Redirecting to file URL:", fileResponse)
		redirect(303, fileResponse) // Redirect to the file URL
	} else {
		throw new Error("File content response is not a valid URL string")
	}
}

export const DELETE: RequestHandler = async ({ params }) => {
	// Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
	const { conversationId, agentId, fileId } = params
	if (!agentId || !conversationId || !fileId) {
		return json({ error: "agentId, conversationId, and fileId are required" }, { status: 400 })
	}

	const dbAgent = await getDBAgent(agentId)

	if (!dbAgent.config.fileSearchEnabled) {
		return json({ error: "File upload is not enabled for this agent" }, { status: 403 })
	}

	const conversation = await getConversation(conversationId)
	//	TODO: validate that conversation belongs to agentId and that user has access to it

	const agent = createAgent(dbAgent)

	try {
		await agent.deleteConversationVectorStoreFile(conversation, fileId)
	} catch (error) {
		throw new Error(`Failed to delete vector store file: ${(error as Error).message}`)
	}

	return new Response(null, { status: 204 })
}
