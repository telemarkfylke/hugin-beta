import { json, type RequestHandler } from "@sveltejs/kit"
import { handleMistralStream, appendToMistralConversation } from "$lib/server/mistral/mistral.js";
import { handleOpenAIStream, appendToOpenAIConversation } from "$lib/server/openai/openai.js";
import { getAgent } from "$lib/server/agents/agents.js";
import { getConversation } from "$lib/server/agents/conversations.js";
import { handleMockAiStream } from "$lib/server/mock-ai/mock-ai.js";
import type { EventStream } from "@mistralai/mistralai/lib/event-streams";
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents";
import type { Stream } from "openai/streaming";
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs";
import { ConversationRequest } from "$lib/types/schemas/requests";
import { responseStream } from "$lib/streaming";


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
  const { conversationId, agentId } = params
  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, { status: 400 })
  }

  const body = await request.json()
  // Validate request body
  const { prompt, stream } = ConversationRequest.parse(body)
  
  const agent = await getAgent(agentId)
  const conversation = await getConversation(conversationId)

  // MOCK AI 
  if (agent.config.type == 'mock-agent') {
    console.log('Mock AI response for agent:', agent._id)
    if (stream) {
      const readableStream = handleMockAiStream(conversation._id);
      return responseStream(readableStream)
    }
    throw new Error('Mock AI agent only supports streaming responses for now...');
  }
  // MISTRAL
  if (agent.config.type == 'mistral-conversation') {
    // Må sjekke at conversations finnes forsatt og...
    console.log('Appending Mistral conversation for agent:', agent._id)
    if (stream) {
      const mistralStream = await appendToMistralConversation(conversation.relatedConversationId, prompt, true) as EventStream<ConversationEvents>;
      const readableStream = handleMistralStream(mistralStream);

      return responseStream(readableStream)
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

    try {
      const openAIResponse = await appendToOpenAIConversation(agent.config, conversation.relatedConversationId, prompt, stream);
      console.log('Received OpenAI response:', openAIResponse);
      if (stream) {
        console.log('Handling OpenAI streaming response');
        const readableStream = handleOpenAIStream(openAIResponse as Stream<ResponseStreamEvent>);

        console.log('Returning streaming response', readableStream);
        return responseStream(readableStream)
      }

      return json(openAIResponse)
    } catch (error) {
      console.error('Error appending to OpenAI conversation:', error);
      return json({ error: 'Failed to get response from OpenAI' }, { status: 500 });
    }

  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}
