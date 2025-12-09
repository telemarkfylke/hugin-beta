import { json, type RequestHandler } from "@sveltejs/kit"
import { getDBAgents } from "$lib/server/agents/agents.js"
import { httpRequestMiddleWare, type MiddlewareNextFunction } from "$lib/server/middleware/http-request"

const getAgents: MiddlewareNextFunction = async ({ user }) => {
	const agents = await getDBAgents(user)
	return {
		response: json({ agents }),
		isAuthorized: true // getDBAgents only returns agents the user has access to, no need to check further (for now)
	}
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async (requestEvent) => {
	return httpRequestMiddleWare(requestEvent, getAgents)
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST: RequestHandler = async () => {
	// Da lager vi en ny agent og redirecter til dens side når det er gjort eller noe fett
	throw new Error("Not implemented yet")
}
