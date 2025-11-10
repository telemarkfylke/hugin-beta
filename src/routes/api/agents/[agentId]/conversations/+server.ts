import { json, type RequestHandler } from "@sveltejs/kit"
import { handleMistralStream, createMistralConversation } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, createOpenAIConversation, createOpenAIConversationStream  } from "$lib/openai/openai.js";
import { getAgent } from "$lib/agents/agents.js";
import { insertConversation } from "$lib/agents/conversations.js";
import { handleMockAiStream } from "$lib/mock-ai/mock-ai.js";

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende (ja, kan fortsatt kanskje hende det)

export const GET: RequestHandler = async ({ params }) : Promise<Response> => {
  // Da spør vi DB om å hente conversations som påkaller har tilgang på i denne assistenten
  console.log(`Fetching conversations for agent ${params.agentId}`)
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

export const POST: RequestHandler = async ({ request, params }) => {
  const body = await request.json()
  const { agentId } = params
  if (!agentId) {
    return json({ error: 'agentId is required' }, { status: 400 })
  }
  const agent = await getAgent(agentId)

  console.log(body)
  const prompt = body.prompt || "Hei, hvordan har du det?"

  // MOCK AI AGENT
  if (agent.config.type == 'mock-agent') {
    if (body.stream) {
      const ourConversation = await insertConversation('mock-agent', {
        name: 'New mock conversation',
        description: 'Mock conversation started via API',
        relatedConversationId: 'mock-conversation-id'
      });
      const readableStream = handleMockAiStream(ourConversation._id);
      
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }
    throw new Error('Mock AI agent only supports streaming responses for now...');
  }

  // MISTRAL AGENT
  if (agent.config.type == 'mistral-conversation') {
    console.log('Creating Mistral conversation', agent._id)
    // Opprett conversation mot Mistral her og returner
    const { mistralConversationId, userLibraryId, stream, response } = await createMistralConversation(agent.config, prompt, body.stream);

    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: mistralConversationId,
      userLibraryId
    });

    if (stream) {
      const readableStream = handleMistralStream(stream, ourConversation._id, userLibraryId);

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
  // OPENAI
  if (agent.config.type == 'openai-prompt') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Creating OpenAI conversation for agent:', agent._id)
    
    if (body.stream) {
      // Create responsestream and return
      const { stream, openAiConversationId } = await createOpenAIConversationStream(agent.config.prompt.id, prompt);

      const ourConversation = await insertConversation(agentId, {
        name: 'New Conversation',
        description: 'Conversation started via API',
        relatedConversationId: openAiConversationId
      });

      const readableStream = handleOpenAIStream(stream, ourConversation._id);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }

    const openAiConversation = await createOpenAIConversation(agent.config.prompt.id, prompt);

    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: openAiConversation.openAiConversationId
    });

    return json({ conversation: ourConversation, initialResponse: openAiConversation.response })
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}