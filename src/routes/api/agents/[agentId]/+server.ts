import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent, patchDBAgent, putDBAgent } from "$lib/server/agents/agents"
import { createVendor } from "$lib/server/agents/vendors"
import { canEditAgent, canPromptAgent } from "$lib/server/auth/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { httpRequestMiddleware } from "$lib/server/middleware/http-request"
import { type Agent, DBAgent, DBAgentPatchInput, DBAgentPutInput } from "$lib/types/agents"
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

const patchAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	const dbAgent: DBAgent = await getDBAgent(requestEvent.params.agentId)

	if (!canEditAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${requestEvent.params.agentId}`)
	}

	const jsonBody = await requestEvent.request.json()

	let agentUpdateInput: DBAgentPatchInput
	try {
		agentUpdateInput = DBAgentPatchInput.parse(jsonBody)
	} catch (zodError) {
		console.log("Zod validation error:", zodError)
		throw new HTTPError(400, "Invalid agent update input", zodError)
	}
	if (Object.keys(agentUpdateInput).length === 0) {
		throw new HTTPError(400, "At least one field must be provided for update")
	}
	// Validate that the updated agent will be valid DBAgent after update
	const resultingDbAgent: DBAgent = {
		...dbAgent,
		...agentUpdateInput,
		// @ts-expect-error (we runtime-validate that the type is correct below)
		config: {
			...dbAgent.config,
			...(agentUpdateInput.config ?? {})
		}
	}
	try {
		DBAgent.parse(resultingDbAgent)
	} catch (zodError) {
		console.log("Zod validation error on resulting agent:", zodError)
		throw new HTTPError(400, "Resulting agent after update is invalid", zodError)
	}
	if (resultingDbAgent.config.type === "manual") {
		const vendorInfo = createVendor(resultingDbAgent.vendorId).getVendorInfo()
		if (!vendorInfo.models.supported.includes(resultingDbAgent.config.model)) {
			throw new HTTPError(400, `Model ${resultingDbAgent.config.model} is not supported by vendor ${vendorInfo.name}`)
		}
	}

	// Update the agent in the database
	const updatedDBAgent: DBAgent = await patchDBAgent(requestEvent.params.agentId, agentUpdateInput)

	const updatedAgent: Agent = createAgent(updatedDBAgent).getAgentInfo()

	return {
		response: json({ agent: updatedAgent } as GetAgentResponse),
		isAuthorized: true
	}
}

export const PATCH: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, patchAgent)
}

const putAgent: MiddlewareNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent.params.agentId) {
		throw new HTTPError(400, "agentId is required")
	}
	const dbAgent: DBAgent = await getDBAgent(requestEvent.params.agentId)

	if (!canEditAgent(user, dbAgent)) {
		throw new HTTPError(403, `User ${user.userId} is not authorized to access agent ${requestEvent.params.agentId}`)
	}
	const requestBody = await requestEvent.request.json()

	// Sjekk at ingen endringer av vendorId skjer
	if (requestBody.vendorId && requestBody.vendorId !== dbAgent.vendorId) {
		throw new HTTPError(400, "Changing vendorId of an agent is not allowed")
	}

	let agentInput: DBAgentPutInput
	try {
		agentInput = DBAgentPutInput.parse(requestBody)
	} catch (zodError) {
		throw new HTTPError(400, "invalid agent input, please check the data you are sending", zodError)
	}
	if (agentInput.config.type === "manual") {
		// Sjekk at model støttes basert på valgt vendorId
		const vendorInfo = createVendor(dbAgent.vendorId).getVendorInfo()
		if (!vendorInfo.models.supported.includes(agentInput.config.model)) {
			throw new HTTPError(400, `Model ${agentInput.config.model} is not supported by vendor ${vendorInfo.name}`)
		}
	}
	const updatedAgent = await putDBAgent(user, agentInput, dbAgent)
	return {
		response: json({ agent: updatedAgent } as GetAgentResponse),
		isAuthorized: true
	}
}

export const PUT: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleware(requestEvent, putAgent)
}
