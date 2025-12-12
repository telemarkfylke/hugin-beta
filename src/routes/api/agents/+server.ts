import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { createDBAgent, getDBAgents } from "$lib/server/agents/agents.js"
import { canCreateAgent, canPromptAgent } from "$lib/server/auth/authorization"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import type { GetAgentsResponse, PostAgentResponse } from "$lib/types/api-responses"
import type { MiddlewareNextFunction } from "$lib/types/middleware/http-request"
import { DBAgentInput } from "$lib/types/agents"
import { HTTPError } from "$lib/server/middleware/http-error"
import { createVendor } from "$lib/server/agents/vendors"

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

export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, getAgents)
}

const createNewAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	// Da lager vi en ny agent og redirecter til dens side når det er gjort eller noe fett
	if (!canCreateAgent(user)) {
		throw new HTTPError(403, "User is not authorized to create agents")
	}
	const requestBody = await requestEvent.request.json()
	// Sjekk at model støttes basert på valgt vendorId

	let agentInput: DBAgentInput
	try {
		agentInput = DBAgentInput.parse(requestBody)
	} catch (zodError) {
		throw new HTTPError(400, "invalid agent input, please check the data you are sending", zodError)
	}
	if (agentInput.config.type === 'manual') {
		const vendorInfo = createVendor(agentInput.vendorId).getVendorInfo()
		if (!vendorInfo.models.supported.includes(agentInput.config.model)) {
			throw new HTTPError(400, `Model ${agentInput.config.model} is not supported by vendor ${vendorInfo.name}`)
		}
	}
	const newAgent = await createDBAgent(user, agentInput)
	return {
		response: json({ agent: newAgent } as PostAgentResponse, { status: 201 }),
		isAuthorized: true
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	// Da lager vi en ny agent og redirecter til dens side når det er gjort eller noe fett
	return httpRequestMiddleware(requestEvent, createNewAgent)
}
