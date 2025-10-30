import { json } from "@sveltejs/kit"
import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import { handleMistralStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream } from "$lib/openai/openai.js";

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request }) => {
  // Da spør vi DB om å hente conversations som påkaller har tilgang på i denne assistenten
  const conversations = [
    {
      _id: 'conversation1',
      name: 'Conversation One',
      description: 'This is the first conversation.',
      relatedConversationId: 'conversation1-id'
    }
  ]
  return json({ conversations })
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST = async ({ request, params }) => {
  // Da skal vi opprette en ny conversation som bruker gitt assistant (og sjekke at påkaller har tilgang på denne assistenten)
  // Hent assistant fra db (eller cache), sjekk tilgang et eller annet fornuftig sted, på en enda mer fornuftig måte
  // Basert på type av assistant (leverandør) så oppretter vi en conversation der
  
  const body = await request.json()

  console.log(body)
  const prompt = body.prompt || "Hei, hvordan har du det?"

  const assistant = {
    _id: 'jijijij',
    name: 'Assistant One',
    type: 'openai',
    vendorAssistant: { 
      id: 'ag_019a34c5b0ee71188693aeb28e1285fe',
      version: '1.0'
    }
  }

  // MISTRAL
  if (assistant.type == 'mistral') {
    console.log('Creating Mistral conversation for assistant:', assistant._id)
    // Opprett conversation mot Mistral her og returner
    const mistral = new Mistral({
      apiKey: env.MISTRAL_API_KEY,
    });
  
    const stream = await mistral.beta.conversations.startStream({
      agentId: 'ag_019a34c5b0ee71188693aeb28e1285fe', // Gunda
      inputs: prompt,
    });

    const readableStream = handleMistralStream(stream);

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }
  // OPENAI
  if (assistant.type == 'openai') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Creating OpenAI conversation for assistant:', assistant._id)
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    
    const conversation = await client.conversations.create({
      metadata: { topic: "demo" },
      items: [
        { type: "message", role: "user", content: "Hello!" }
      ],
    });

    // Create responsestream and return
    const stream = await client.responses.create({
      stream: true,
      prompt: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0' // Gunda 2 ellerno
      },
      conversation: conversation.id,
      input: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const readableStream = handleOpenAIStream(stream);

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }

  return json({ balle: 'frans' })
}