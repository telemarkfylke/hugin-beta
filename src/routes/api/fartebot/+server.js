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
    const apiKey = env.OPENAI_API_KEY_KOLLEKTIV;

    const client = new OpenAI({
        apiKey: apiKey
    });

    const response = await client.responses.create({
        model: "gpt-4.1",
        input: "Hva koseter det å leie en bysykkel i tre og en halv time?",
        tools: [
            {
                type: "file_search",
                vector_store_ids: [env.VS_BYSYKKEL],
            },
        ],
        stream: true,
    });

    for await (const event of response) {
    console.log(event);
}

    
    return new Response(JSON.stringify({ message: response.output_text }), { status: 200 });
};