import { json, type RequestHandler } from "@sveltejs/kit"
import { getAgents } from "$lib/server/agents/agents.js"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async () => {
	// Da spør vi DB om å hente agenter som påkaller har tilgang på TODO - ferdig type og validering
	const agents = await getAgents()
	return json({ agents })
}
