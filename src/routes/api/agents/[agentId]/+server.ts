import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent, updateDBAgent } from "$lib/server/agents/agents"
import { canEditAgent, canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { DBAgentUpdateInput, type Agent, type DBAgent } from "$lib/types/agents"
import type { GetAgentResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const getAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	const dbAgent: DBAgent = await getDBAgent(requestEvent.params.agentId)

	if (!canPromptAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${requestEvent.params.agentId}`)
	}

	// If agent has vector store or library, we want to include files as well - this should be implemented in each agent type (interface IAgent) - but not now...

	const agent: Agent = createAgent(dbAgent).getAgentInfo()

	return {
		response: json({ agent } as GetAgentResponse),
		isAuthorized: true
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getAgent)
}

const updateAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	const dbAgent: DBAgent = await getDBAgent(requestEvent.params.agentId)

	if (!canEditAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${requestEvent.params.agentId}`)
	}
	
	const jsonBody = await requestEvent.request.json()

	let agentUpdateInput: DBAgentUpdateInput
	try {
		agentUpdateInput = DBAgentUpdateInput.parse(jsonBody)
	} catch (zodError) {
		console.log("Zod validation error:", zodError)
		throw new HTTPError(400, "Invalid agent update input", zodError)
	}
	if (Object.keys(agentUpdateInput).length === 0) {
		throw new HTTPError(400, "At least one field must be provided for update")
	}
	
	// Update the agent in the database
	const updatedDBAgent: DBAgent = await updateDBAgent(requestEvent.params.agentId, agentUpdateInput)

	const updatedAgent: Agent = createAgent(updatedDBAgent).getAgentInfo()

	return {
		response: json({ agent: updatedAgent } as GetAgentResponse),
		isAuthorized: true
	}
}

export const PATCH: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, updateAgent)
}

