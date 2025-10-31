import { json } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request }) => {
  // Da spør vi DB om å hente agenter som påkaller har tilgang på
  const agents = [
    {
      _id: 'agents 1',
      name: 'Agent One',
      description: 'This is the first Agent.',
      type: 'mistral',
      agentId: 'Agent1-id'
    }
  ]
  return json({ agents })
}