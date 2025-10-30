import { json } from "@sveltejs/kit"

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request }) => {
  // Da spør vi DB om å hente assistenter som påkaller har tilgang på
  const assistants = [
    {
      _id: 'assistant1',
      name: 'Assistant One',
      description: 'This is the first assistant.',
      type: 'mistral',
      assistantId: 'assistant1-id'
    }
  ]
  return json({ assistants })
}