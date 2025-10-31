import { json } from "@sveltejs/kit"
import { env } from "$env/dynamic/private";
import { handleMistralStream, createMistralConversation, createMistralConversationStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, createOpenAIConversation, createOpenAIConversationStream  } from "$lib/openai/openai.js";
import { getAssistant } from "$lib/assistants/assistants.js";
import { insertConversation } from "$lib/assistants/conversations.js";

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
  const { assistantId } = params
  if (!assistantId) {
    return json({ error: 'assistantId is required' }, { status: 400 })
  }
  const assistant = await getAssistant(assistantId)

  console.log(body)
  const prompt = body.prompt || "Hei, hvordan har du det?"

  // MISTRAL
  if (assistant.type == 'mistral') {
    console.log('Creating Mistral conversation for assistant:', assistant._id)
    if (body.stream) {
      // Opprett conversation mot Mistral her og returner
      const { stream, mistralConversationId } = await createMistralConversationStream(assistant.config.vendorAssistant.id, prompt);

      const ourConversation = await insertConversation(assistantId, {
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
    const mistralConversation = await createMistralConversation(assistant.config.vendorAssistant.id, prompt);
    
    const ourConversation = await insertConversation(assistantId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: mistralConversation.mistralConversationId
    });

    return json({ conversation: ourConversation, initialResponse: mistralConversation.response })
  }
  // OPENAI
  if (assistant.type == 'openai') {
    // Opprett conversation mot OpenAI her og returner
    console.log('Creating OpenAI conversation for assistant:', assistant._id)
    
    if (body.stream) {
      // Create responsestream and return
      const { stream, openAiConversationId } = await createOpenAIConversationStream(assistant.config.vendorAssistant.id, prompt);

      const ourConversation = await insertConversation(assistantId, {
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

    const openAiConversation = await createOpenAIConversation(assistant.config.vendorAssistant.id, prompt);

    const ourConversation = await insertConversation(assistantId, {
      name: 'New Conversation',
      description: 'Conversation started via API',
      relatedConversationId: openAiConversation.openAiConversationId
    });

    return json({ conversation: ourConversation, initialResponse: openAiConversation.response })
  }

  return json({ balle: 'frans' })
}