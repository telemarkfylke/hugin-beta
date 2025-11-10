import type { Agent } from "$lib/types/agents"
import { json, type RequestHandler } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET: RequestHandler = async () => {
  // Da spør vi DB om å hente assistenter som påkaller har tilgang på
  const agent: Agent = {
    _id: 'agent1',
    name: 'agent One',
    description: 'This is the first agent.',
    config: {
      type: 'mock-agent'
    }
  }
  return json({ agent })
}