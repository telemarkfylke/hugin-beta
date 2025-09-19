import { env } from "$env/dynamic/private";
import OpenAI from "openai";

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
    // Get environment variable
    const apiKey = env.OPENAI_API_KEY;

    const client = new OpenAI({
        apiKey: apiKey
    });

    const response = await client.responses.create({
        model: "gpt-5",
        input: "Write a one-sentence bedtime story about a unicorn."
    });
    
    return new Response(JSON.stringify({ message: response.output_text }), { status: 200 });
};