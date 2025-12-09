import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getDBConversation } from "$lib/server/agents/conversations.js"
import { canPromptAgent, canViewConversation } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { responseStream } from "$lib/streaming"
import { ConversationRequest, type GetConversationResult } from "$lib/types/requests"

const getConversation: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId || !requestEvent.params.conversationId) {
		throw new HTTPError(400, "agentId and conversationId are required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)
	if (!canPromptAgent(user, dbAgent)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const conversation = await getDBConversation(requestEvent.params.conversationId)
	if (!canViewConversation(user, conversation)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const agent = createAgent(dbAgent)
	const { messages } = await agent.getConversationMessages(conversation)
	const response: GetConversationResult = {
		conversation,
		items: messages
	}
	return {
		response: json(response),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getConversation)
}

const appendMessageToConversation: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId || !requestEvent.params.conversationId) {
		throw new HTTPError(400, "agentId and conversationId are required")
	}
	const dbAgent = await getDBAgent(requestEvent.params.agentId)
	if (!canPromptAgent(user, dbAgent)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}
	const conversation = await getDBConversation(requestEvent.params.conversationId)
	if (!canViewConversation(user, conversation)) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}

	const body = await requestEvent.request.json()
	// Validate request body
	const { prompt, stream } = ConversationRequest.parse(body)

	const agent = createAgent(dbAgent)
	const { response } = await agent.appendMessageToConversation(conversation, prompt, stream)
	if (stream) {
		return {
			response: responseStream(response),
			isAuthorized: true
		}
	}
	throw new Error("Non-streaming append message not implemented yet")
}

export const POST: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, appendMessageToConversation)
}
