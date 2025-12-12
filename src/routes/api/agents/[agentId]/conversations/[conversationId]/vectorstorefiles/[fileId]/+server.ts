import type { RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getDBConversation } from "$lib/server/agents/conversations"
import { canPromptAgent, canViewConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

// import type { IAgentResults } from "$lib/types/agents"

const getConversationVectorStoreFileContent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	const { agentId, conversationId, fileId } = requestEvent.params
	if (!agentId || !conversationId || !fileId) {
		throw new HTTPError(400, "agentId, conversationId, and fileId are required")
	}

	const dbAgent = await getDBAgent(agentId)
	if (!canPromptAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${agentId}`)
	}
	if (!dbAgent.config.vectorStoreEnabled) {
		throw new HTTPError(403, "File upload is not enabled for this agent")
	}
	const conversation = await getDBConversation(conversationId)
	if (!canViewConversation(user, conversation)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access conversation ${conversationId}`)
	}

	throw new Error("File download not fully implemented yet, need to think about it first")

	/*

	const agent = createAgent(dbAgent)

	let fileResponse: IAgentResults["GetConversationVectorStoreFileContentResult"]
	try {
		fileResponse = await agent.getConversationVectorStoreFileContent(conversation, fileId)
		// Return the file as a downloadable url or blob or something
	} catch (error) {
		throw new Error(`Failed to get vector store file content: ${(error as Error).message}`)
	}
	throw new Error("File download not fully implemented yet, need to think about it first")
	
	if (fileResponse.redirectUrl) {
		console.log("Redirecting to file URL:", fileResponse.redirectUrl)
		redirect(303, fileResponse.redirectUrl) // Redirect to the file URL
	} else {
		throw new Error("File content response is not a valid URL string")
	}
	*/
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getConversationVectorStoreFileContent)
}

const deleteConversationVectorStoreFile: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	// Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
	const { conversationId, agentId, fileId } = requestEvent.params
	if (!agentId || !conversationId || !fileId) {
		throw new HTTPError(400, "agentId, conversationId, and fileId are required")
	}

	const dbAgent = await getDBAgent(agentId)
	if (!canPromptAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${agentId}`)
	}
	if (!dbAgent.config.vectorStoreEnabled) {
		throw new HTTPError(403, "File upload is not enabled for this agent")
	}
	const conversation = await getDBConversation(conversationId)
	if (!canViewConversation(user, conversation)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access conversation ${conversationId}`)
	}

	const agent = createAgent(dbAgent)

	await agent.deleteConversationVectorStoreFile(conversation, fileId)

	return {
		response: new Response(null, { status: 204 }),
		isAuthorized: true
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, deleteConversationVectorStoreFile)
}
