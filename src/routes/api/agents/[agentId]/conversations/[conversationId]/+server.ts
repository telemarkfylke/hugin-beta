import { json, type RequestHandler } from "@sveltejs/kit"
import { handleMistralStream, appendToMistralConversation } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, appendToOpenAIConversation } from "$lib/openai/openai.js";
import { getAgent } from "$lib/agents/agents.js";
import { getConversation } from "$lib/agents/conversations.js";
import { handleMockAiStream } from "$lib/mock-ai/mock-ai.js";
import type { EventStream } from "@mistralai/mistralai/lib/event-streams";
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents";
import type { Stream } from "openai/streaming";
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs";


export const GET: RequestHandler = async ({ params }): Promise<Response> => {
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

export const POST: RequestHandler = async ({ request, params }): Promise<Response> => {
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

  // MOCK AI 
  if (agent.config.type == 'mock-agent') {
    console.log('Mock AI response for agent:', agent._id)
    if (body.stream) {
      const stream = handleMockAiStream(conversation._id);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }
    throw new Error('Mock AI agent only supports streaming responses for now...');
  }
  // MISTRAL
  if (agent.config.type == 'mistral-conversation') {
    // Må sjekke at conversations finnes forsatt og...
    console.log('Appending Mistral conversation for agent:', agent._id)
    if (body.stream) {
      const stream = await appendToMistralConversation(conversation.relatedConversationId, prompt, true) as EventStream<ConversationEvents>;
      const readableStream = handleMistralStream(stream);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }
    const response = await appendToMistralConversation(conversation.relatedConversationId, prompt, false);

    return json({ response })
  }
  // OPENAI
  if (agent.config.type == 'openai-response') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Appending OpenAI conversation for agent:', agent._id)

    // Sjekk om vi har vectorStoreId i conversation og legg til i tools i så fall
    if (conversation.vectorStoreId) {
      if (!agent.config.tools) {
        agent.config.tools = [];
      }
      const fileSearchTool = agent.config.tools.find(tool => tool.type === 'file_search')
      if (!fileSearchTool) {
        agent.config.tools.push({
          type: 'file_search',
          vector_store_ids: [conversation.vectorStoreId]
        });
      } else {
        fileSearchTool.vector_store_ids.push(conversation.vectorStoreId);
      }
    }

    const response = await appendToOpenAIConversation(agent.config, prompt, body.stream);
    console.log('OpenAI append response:', response);
    if (body.stream) {
      const readableStream = handleOpenAIStream(response as Stream<ResponseStreamEvent>);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }

    return json(response)
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}
