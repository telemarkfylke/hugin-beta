import { json } from "@sveltejs/kit"
import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import { handleMistralStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream } from "$lib/openai/openai.js";

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request, params }) => {
  console.log(params)
  // Da spør vi om å få historikken til denne samtalen i denne assistenten fra leverandør basert på assistan
  const conversation = {
      _id: 'conversation1',
      name: 'Conversation One',
      description: 'This is the first conversation.',
      relatedConversationId: 'conversation1-id',
      items: [
        {
          type: 'message',
          content: 'Hello, how can I assist you today?'
        }
      ]
  }
  return json(conversation)
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST = async ({ request }) => {
  // Da legger vi til en ny melding i samtalen i denne assistenten via leverandør basert på assistanten, og får tilbake responseStream med oppdatert samtalehistorikk
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

  const conversation = {
    _id: 'conversation1',
    name: 'Conversation One',
    description: 'This is the first conversation.',
    relatedConversationId: 'conversation1-id'
  }

  // MISTRAL
  if (assistant.type == 'mistral') {
    // Må sjekke at conversations finnes forsatt og...
    console.log('Appending Mistral conversation for assistant:', assistant._id)
    // Opprett conversation mot Mistral her og returner Flytt ut til mistral en gang
    const mistral = new Mistral({
      apiKey: env.MISTRAL_API_KEY,
    });

    const stream = await mistral.beta.conversations.appendStream({
      conversationId: conversation.relatedConversationId,
      conversationAppendStreamRequest: {
        inputs: prompt
      }
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
    

    // Create responsestream and return
    const stream = await client.responses.create({
      stream: true,
      prompt: {
        id: 'pmpt_68ca8d43f1108197b5c81bd32014f34e04d1daa9ea89d5a0' // Gunda 2 ellerno
      },
      conversation: conversation.relatedConversationId,
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
