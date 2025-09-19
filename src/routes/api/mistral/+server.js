import { env } from "$env/dynamic/private";
import { Mistral } from '@mistralai/mistralai';

/**
 * GET handler for OpenAI responses endpoint
 * Creates a response using OpenAI's responses API with a predefined prompt
 * @param {Object} event - SvelteKit request event object
 * @param {Request} event.request - The incoming HTTP request
 * @returns {Promise<Response>} JSON response containing the OpenAI generated message
 * @throws {Error} When OpenAI API key is not configured or API request fails
 * @example
 * // GET /api/openai
 * // Returns: { "message": "Generated bedtime story response" }
 */
export const GET = async ({ request }) => {

const apiKey = env.MISTRAL_API_KEY;
const client = new Mistral({apiKey: apiKey});

const chatResponse = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{role: 'user', content: 'What is the best French cheese?'}],
});

console.log('Chat:', chatResponse.choices[0].message.content);
return new Response(JSON.stringify({ message: chatResponse.choices[0].message.content }), { status: 200 });

};