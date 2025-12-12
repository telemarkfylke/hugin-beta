import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents"
import { canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { Agent, DBAgent } from "$lib/types/agents"
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

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getAgent)
}
