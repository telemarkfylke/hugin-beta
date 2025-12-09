import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents"
import type { Agent, DBAgent } from "$lib/types/agents"
import { httpRequestMiddleWare, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"
import { canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"

const getAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	const dbAgent: DBAgent = await getDBAgent(requestEvent.params.agentId)
	if (!dbAgent) {
		return {
			response: json({ error: `Agent ${requestEvent.params.agentId} not found` }, { status: 404 }),
			isAuthorized: false
		}
	}

	const authorized = canPromptAgent(user, dbAgent)
	if (!authorized) {
		return {
			response: new Response("Forbidden", { status: 403 }),
			isAuthorized: false
		}
	}

	// If agent has vector store or library, we want to include files as well - this should be implemented in each agent type (interface IAgent) - but not now...

	const agent: Agent = createAgent(dbAgent).getAgentInfo()
	
	return {
		response: json({ agent }),
		isAuthorized: true
	}
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleWare(requestEvent, getAgent)
}
