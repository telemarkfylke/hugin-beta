import { json } from "@sveltejs/kit"
import { handleMistralStream, createMistralConversation, createMistralConversationStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, createOpenAIConversation, createOpenAIConversationStream  } from "$lib/openai/openai.js";
import { getAgent } from "$lib/agents/agents.js";
import { insertConversation } from "$lib/agents/conversations.js";

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende (ja, kan fortsatt kanskje hende det)

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
  const body = await request.json()
  const { agentId } = params
  if (!agentId) {
    return json({ error: 'agentId is required' }, { status: 400 })
  }
  const agent = await getAgent(agentId)

  console.log(body)
  const prompt = body.prompt || "Hei, hvordan har du det?"

  // MISTRAL AGENT
  if (agent.config.type == 'mistral-agent') {
    console.log('Creating Mistral conversation for agent:', agent._id)
    if (body.stream) {
      // Opprett conversation mot Mistral her og returner
      const { stream, mistralConversationId } = await createMistralConversationStream(agent.config.agentId, prompt);

      const ourConversation = await insertConversation(agentId, {
        name: 'New Conversation',
        description: 'Conversation started via API',
        relatedConversationId: mistralConversationId
      });

      const readableStream = handleMistralStream(stream, ourConversation._id);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }
    const mistralConversation = await createMistralConversation(agent.config.agentId, prompt);
    
    const ourConversation = await insertConversation(agentId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: mistralConversation.mistralConversationId
    });

    return json({ conversation: ourConversation, initialResponse: mistralConversation.response })
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

  return json({ balle: 'frans' })
}