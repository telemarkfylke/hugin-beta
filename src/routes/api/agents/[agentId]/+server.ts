import { json } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request }) => {
  // Da spør vi DB om å hente assistenter som påkaller har tilgang på
  const agent = {
    _id: 'agent1',
    name: 'agent One',
    description: 'This is the first agent.',
    type: 'mistral',
      agentId: 'agent1-id'
    }
  return json({ agents })
}