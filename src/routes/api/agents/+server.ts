import { json, type RequestHandler } from "@sveltejs/kit"
import { createDBAgent, getDBAgents } from "$lib/server/agents/agents.js"
import type { DBAgentInput } from "$lib/types/agents"
import { logger } from "@vestfoldfylke/loglady"
import { canPromptAgent } from "$lib/server/auth/authorization"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { GetAgentsResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"

const getAgents: MiddlewareNextFunction = async ({ user }) => {
	const agents = await getDBAgents(user)

	const unauthorizedAgents = agents.filter((agent) => !canPromptAgent(user, agent))
	const authorizedAgents = agents.filter((agent) => canPromptAgent(user, agent))
	if (unauthorizedAgents.length > 0) {
		// This should not happen as getDBAgents filters based on user access
		logger.warn(
			"User: {userId} got {count} agents they are not authorized to view from db query. Filtered them out, but take a look at _ids {@ids}",
			user.userId,
			unauthorizedAgents.length,
			unauthorizedAgents.map((c) => c._id)
		)
	}

	return {
		response: json({ agents: authorizedAgents } as GetAgentsResponse),
		isAuthorized: true
	}
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getAgents)
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST: RequestHandler = async ({ request, params }) => {
	// Da lager vi en ny agent og redirecter til dens side når det er gjort
	const input:DBAgentInput = await request.json()
	const createdAgent = await createDBAgent(input)
	return json( createdAgent)
	//throw new Error("Not implemented yet")

}

