import { getAgents } from "$lib/agents/agents.js"
import { json } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request }) => {
  // Da spør vi DB om å hente agenter som påkaller har tilgang på
  const agents = await getAgents();
  return json({ agents })
}