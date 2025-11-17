import { getAgent } from "$lib/server/agents/agents";
import type { Agent } from "$lib/types/agents"
import { json, type RequestHandler } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async ({ params }) => {
  // Da spør vi DB om å hente assistenter som påkaller har tilgang på TODO - ferdig type og validering
  if (!params.agentId) {
    throw new Error('agentId is required');
  }
  console.log(`Fetching agent with ID ${params.agentId}`)
  const agent: Agent = await getAgent(params.agentId);
  if (!agent) {
    return json({ error: `Agent ${params.agentId} not found` }, { status: 404 });
  }
  
  return json({ agent })
}