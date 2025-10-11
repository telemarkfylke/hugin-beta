import { env } from "$env/dynamic/private";
import { Mistral } from '@mistralai/mistralai';
import { essay } from "$lib/data/rag_essay.js";


async function getEmbeddings(chunk) {
  const apiKey = env.MISTRAL_API_KEY;
  const client = new Mistral({apiKey: apiKey});

  const embedding = await client.embeddings.create({
    model: "mistral-embed",
    inputs: chunk
  });
  return embedding;
}


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

//   // Get the RAG essay data
// console.log('RAG Essay:', essay.title );
// const chunckSize = 2048;
// let chunks = [];
// for (let i = 0; i < essay.content.length; i += chunckSize) {
//     chunks.push(essay.content.slice(i, i + chunckSize));
// }

// console.log('Chunks:', chunks.length, chunks[0]);

// let embeddingResult = [];

// for (let i = 0; i < chunks.length; i++) {
//   embeddingResult.push(await getEmbeddings(chunks[i]));
//   console.log(`Processed chunk ${i + 1} of ${chunks.length}`);
// }

// console.log('Embeddings:', embeddingResult.length, embeddingResult[0]);

const apiKey = env.MISTRAL_API_KEY;
const client = new Mistral({apiKey: apiKey});

const ocrResponse = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
        type: "document_url",
        documentUrl: "https://arxiv.org/pdf/2201.04234"
    },
    includeImageBase64: false
});

const chatResponse = await client.chat.complete({
  model: 'mistral-large-latest',
  messages: [{role: 'user', content: 'Lag en kort oppsummering av dokumentet på norsk.' + JSON.stringify(ocrResponse)}],
});


console.log('OCR Response:', ocrResponse);

// console.log('Chat:', chatResponse.choices[0].message.content);
return new Response(JSON.stringify({ message: chatResponse}), { status: 200 });

};''