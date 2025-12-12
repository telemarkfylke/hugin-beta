import { json, type RequestHandler } from "@sveltejs/kit"
import { createDBAgent, getDBAgents } from "$lib/server/agents/agents.js"
import type { DBAgentInput } from "$lib/types/agents"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async () => {
	// Da spør vi DB om å hente agenter som påkaller har tilgang på TODO - ferdig type og validering
	const agents = await getDBAgents()
	return json({ agents })
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

