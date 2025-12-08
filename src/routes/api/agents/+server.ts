import { json, type RequestHandler } from "@sveltejs/kit"
import { getDBAgents } from "$lib/server/agents/agents.js"

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
export const POST: RequestHandler = async () => {
	// Da lager vi en ny agent og redirecter til dens side når det er gjort
	throw new Error("Not implemented yet")
}

