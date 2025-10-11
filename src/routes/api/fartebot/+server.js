import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { systemledetekster } from "$lib/data/systemledetekster.js";

/**
 * POST handler for OpenAI responses endpoint
 * Creates a response using OpenAI's responses API with user-provided question
 * @param {Object} event - SvelteKit request event object
 * @param {Request} event.request - The incoming HTTP request
 * @returns {Promise<Response>} JSON response containing the OpenAI generated message
 * @throws {Error} When OpenAI API key is not configured or API request fails
 * @example
 * // POST /api/fartebot
 * // Body: { "question": "What does it cost to rent a city bike?" }
 * // Returns: { "message": "Generated response from OpenAI" }
 */
export const POST = async ({ request }) => {
    try {
        // Get environment variable
        const apiKey = env.OPENAI_API_KEY_KOLLEKTIV;

        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Parse request body
        const body = await request.json();
        const { question } = body;

        if (!question || typeof question !== 'string' || !question.trim()) {
            return new Response(JSON.stringify({ error: 'Question is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const client = new OpenAI({
            apiKey: apiKey
        });

        const response = await client.responses.create({
            model: "gpt-5",
            reasoning: { effort: "low" },
            instructions: systemledetekster.fartebort.prompt,
            input: question.trim(),
            tools: [
                {
                    type: "file_search",
                    vector_store_ids: [env.VS_BYSYKKEL],
                },
            ],
            stream: true,
        });

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of response) {
                        console.log('Event type:', event.type, 'Event:', event);

                        // Send all events and let frontend filter
                        const chunk = `data: ${JSON.stringify(event)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(chunk));
                    }

                    // Send completion signal
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                } catch (error) {
                    controller.error(error);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (error) {
        console.error('Fartebot API error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};