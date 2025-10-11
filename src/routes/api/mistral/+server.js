import { env } from "$env/dynamic/private";
import { Mistral } from '@mistralai/mistralai';

/**
 * GET handler for Mistral AI endpoint
 * Creates a response using Mistral AI API with a predefined prompt
 * @returns {Promise<Response>} JSON response containing the Mistral generated message
 * @throws {Error} When Mistral API key is not configured or API request fails
 * @example
 * // GET /api/mistral
 * // Returns: { "message": "Generated response about French cheese" }
 */
export const GET = async () => {

const apiKey = env.MISTRAL_API_KEY;
const client = new Mistral({apiKey: apiKey});

const chatResponse = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{role: 'user', content: 'What is the best French cheese?'}],
});

console.log('Chat:', chatResponse.choices[0].message.content);
return new Response(JSON.stringify({ message: chatResponse.choices[0].message.content }), { status: 200 });

};