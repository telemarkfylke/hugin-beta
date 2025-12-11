import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { deleteDBConversation, getDBAgentUserConversations, insertDBConversation, updateDBConversation } from "$lib/server/agents/conversations.js"
import { getUserInputTextFromPrompt } from "$lib/server/agents/message"
import { canPromptAgent, canViewConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import { ConversationRequest } from "$lib/types/requests"
import type { GetAgentConversationsResponse } from "$lib/types/api-responses"
import { logger } from "@vestfoldfylke/loglady"

const getAgentUserConversations: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	const agentUserConversations = await getDBAgentUserConversations(requestEvent.params.agentId, user.userId)

	const authorizedConversations = agentUserConversations.filter(conversation => canViewConversation(user, conversation))
	const unauthorizedConversations = agentUserConversations.filter(conversation => !canViewConversation(user, conversation))
	if (unauthorizedConversations.length > 0) {
		// This should not happen as getDBAgents filters based on user access
		logger.warn(
			`User: {userId} got {count} conversations they are not authorized to view from db query. Filtered them out, but take a look at _ids {@ids}`,
			user.userId,
			unauthorizedConversations.length,
			unauthorizedConversations.map((c) => c._id)
		)
	}

	return {
		response: json({ conversations: authorizedConversations } as GetAgentConversationsResponse),
		isAuthorized: true
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
