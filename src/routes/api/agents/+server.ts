import { getAgents } from "$lib/agents/agents.js"
import { json, type RequestHandler } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async () => {
  // Da spør vi DB om å hente agenter som påkaller har tilgang på
  const agents = await getAgents();
  return json({ agents })
}