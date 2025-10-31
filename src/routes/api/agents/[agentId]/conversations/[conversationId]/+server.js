import { json } from "@sveltejs/kit"
import { Mistral } from "@mistralai/mistralai";
import OpenAI from "openai";
import { env } from "$env/dynamic/private";
import { handleMistralStream, appendToMistralConversation, appendToMistralConversationStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, appendToOpenAIConversation, appendToOpenAIConversationStream } from "$lib/openai/openai.js";
import { getAgent } from "$lib/agents/agents.js";
import { getConversation } from "$lib/agents/conversations.js";

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request, params }) => {
  console.log(params)
  // Da spør vi om å få historikken til denne samtalen i denne assistenten fra leverandør basert på agenten
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
export const POST = async ({ request, params }) => {
  // Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
  const body = await request.json()
  const { conversationId, agentId } = params
  
  console.log(body)
  const prompt = body.prompt || "Hei, hvordan har du det?"

  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, { status: 400 })
  }

  const agent = await getAgent(agentId)
  const conversation = await getConversation(conversationId)

  // MISTRAL
  if (agent.type == 'mistral') {
    // Må sjekke at conversations finnes forsatt og...
    console.log('Appending Mistral conversation for agent:', agent._id)
    // Opprett conversation mot Mistral her og returner Flytt ut til mistral en gang
    const mistral = new Mistral({
      apiKey: env.MISTRAL_API_KEY,
    });

    if (body.stream) {
      const stream = await appendToMistralConversationStream(conversation.relatedConversationId, prompt);

      const readableStream = handleMistralStream(stream);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }
    const response = await appendToMistralConversation(conversation.relatedConversationId, prompt);

    return json({ response })
  }
  // OPENAI
  if (agent.type == 'openai') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Appending OpenAI conversation for agent:', agent._id)
    if (body.stream) {
      const stream = await appendToOpenAIConversationStream(agent.config.vendorAgent.id, conversation.relatedConversationId, prompt);

      const readableStream = handleOpenAIStream(stream);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }

    const response = await appendToOpenAIConversation(agent.config.vendorAgent.id, conversation.relatedConversationId, prompt);

    return json(response)
  }
  return json({ balle: 'frans' })
}
