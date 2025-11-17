import { json, type RequestHandler } from "@sveltejs/kit"
import { handleMistralStream, createMistralConversation } from "$lib/server/mistral/mistral.js";
import { handleOpenAIStream, createOpenAIConversation } from "$lib/server/openai/openai.js";
import { getAgent } from "$lib/server/agents/agents.js";
import { getConversations, insertConversation } from "$lib/server/agents/conversations.js";
import { handleMockAiStream } from "$lib/server/mock-ai/mock-ai.js";
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs";
import type { Stream } from "openai/streaming";
import { ConversationRequest } from "$lib/types/requests";
import { responseStream } from "$lib/streaming";
import { createOllamaAIConversation, handleOllamaStream } from "$lib/server/ollama/ollama";

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende (ja, kan fortsatt kanskje hende det)

export const GET: RequestHandler = async ({ params }) : Promise<Response> => {
  // Da spør vi DB om å hente conversations som påkaller har tilgang på i denne assistenten
  if (!params.agentId) {
    throw new Error('agentId is required');
  }
  console.log(`Fetching conversations for agent ${params.agentId}`)
  const conversations = await getConversations(params.agentId);

  return json({ conversations })
}

export const POST: RequestHandler = async ({ request, params }) => {
  const { agentId } = params
  if (!agentId) {
    return json({ error: 'agentId is required' }, { status: 400 })
  }

  const body = await request.json()
  // Validate request body
  const { prompt, stream } = ConversationRequest.parse(body)

  const agent = await getAgent(agentId)

  // MOCK AI AGENT
  if (agent.config.type == 'mock-agent') {
    if (stream) {
      const ourConversation = await insertConversation('mock-agent', {
        name: 'New mock conversation',
        description: 'Mock conversation started via API',
        relatedConversationId: 'mock-conversation-id',
        vectorStoreId: null
      });
      const readableStream = handleMockAiStream(ourConversation._id);
      
      return responseStream(readableStream)
    }
    throw new Error('Mock AI agent only supports streaming responses for now...');
  }

  // MISTRAL AGENT
  if (agent.config.type == 'mistral-conversation') {
    console.log('Creating Mistral conversation', agent._id)
    // Opprett conversation mot Mistral her og returner
    const { mistralConversationId, userLibraryId, mistralStream, mistralResponse } = await createMistralConversation(agent.config, prompt, stream);

    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: mistralConversationId,
      vectorStoreId: userLibraryId
    });

    if (stream) {
      if (!mistralStream) {
        throw new Error('Mistral stream is not available for streaming response, check implementation');
      }
      const readableStream = handleMistralStream(mistralStream, ourConversation._id, userLibraryId);

      return responseStream(readableStream)
    }
    return json({ conversation: ourConversation, initialResponse: mistralResponse })
  }
  // OPENAI
  if (agent.config.type == 'openai-response') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Creating OpenAI conversation for agent:', agent._id)
    
    // Create responsestream and return
    const { response, openAiConversationId } = await createOpenAIConversation(agent.config, prompt, stream) as {response: Stream<ResponseStreamEvent>, openAiConversationId: string}; // Todo, gjør dette bedre med typer

    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: openAiConversationId,
      vectorStoreId: null
    });

    if (stream) {
      const readableStream = handleOpenAIStream(response, ourConversation._id);

      return responseStream(readableStream)
    }

    return json({ conversation: ourConversation, initialResponse: response })
  }

  // OLLAMA
  if (agent.config.type == 'ollama-response') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Creating OpenAI conversation for agent:', agent._id)

    // Create responsestream and return
    const { response, openAiConversationId } = await createOllamaAIConversation(agent.config, prompt, body.stream) as { response: Stream<ResponseStreamEvent>, openAiConversationId: string }; // Todo, gjør dette bedre med typer

    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: openAiConversationId,
      vectorStoreId: null
    });

    if (body.stream) {
      const readableStream = handleOllamaStream(response, ourConversation._id);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }

    return json({ conversation: ourConversation, initialResponse: response })
  }

  throw new Error(`Unsupported agent config type: ${agent.config}`);
}