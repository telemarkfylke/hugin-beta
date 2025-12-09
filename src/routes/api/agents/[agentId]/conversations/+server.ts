import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { deleteDBConversation, getDBAgentUserConversations, insertDBConversation, updateDBConversation } from "$lib/server/agents/conversations.js"
import { getUserInputTextFromPrompt } from "$lib/server/agents/message"
import { canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import { ConversationRequest } from "$lib/types/requests"

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende (ja, kan fortsatt kanskje hende det)

const getAgentUserConversations: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	const agentUserConversations = await getDBAgentUserConversations(requestEvent.params.agentId, user.userId)
	return {
		response: json({ conversations: agentUserConversations }),
		isAuthorized: true // getDBAgentUserConversations only returns conversations the user has access to, no need to check further
	}
}

export const GET: RequestHandler = async (requestEvent): Promise<Response> => {
	// Da spør vi DB om å hente conversations som påkaller har tilgang på i denne assistenten
	return httpRequestMiddleware(requestEvent, getAgentUserConversations)
}

const createAgentConversation: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)

	// Check if user can prompt this agent
	const authorized = canPromptAgent(user, dbAgent)
	if (!authorized) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}

	const body = await requestEvent.request.json()
	const { prompt, stream } = ConversationRequest.parse(body)

	const agent = createAgent(dbAgent)
	const promptText = getUserInputTextFromPrompt(prompt)

	const dbConversation = await insertDBConversation(requestEvent.params.agentId, {
		name: promptText ? promptText.substring(0, 20) : "New Conversation",
		vendorId: dbAgent.vendorId,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		owner: {
			objectId: user.userId,
			name: user.name
		},
		description: "Conversation started via API",
		vendorConversationId: "",
		vectorStoreId: null
	})

	try {
		const { vendorConversationId, response, vectorStoreId } = await agent.createConversation(dbConversation, prompt, stream)

		// Updates our conversation with the correct vendorConversationId and vectorStoreId
		await updateDBConversation(dbConversation._id, {
			vendorConversationId,
			vectorStoreId
		})

		if (stream) {
			return {
				response: responseStream(response),
				isAuthorized: true
			}
		}
		throw new HTTPError(500, "Non-streaming create conversation not implemented yet")
	} catch (error) {
		// delete the conversation we just created in db
		await deleteDBConversation(dbConversation._id)
		throw error
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, createAgentConversation)
}
