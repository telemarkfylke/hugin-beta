import { json } from "@sveltejs/kit"
import { getAgent } from "$lib/server/agents/agents.js";
import { getConversation, updateConversation } from "$lib/server/agents/conversations.js";
import { uploadDocumentsToMistralLibrary } from "$lib/server/mistral/document-library.js";
import { uploadDocumentsToOpenAIVectorStore } from "$lib/server/openai/vector-store.js";

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ request, params }) => {
  console.log(params)
  const files = {
      _id: 'blablabla',
  }
  return json(files)
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST = async ({ request, params }) => {
  // Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
  const { conversationId, agentId } = params
  const body = await request.formData()

  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, { status: 400 })
  }

  const streaming = body.get('stream') === 'true'

  const agent = await getAgent(agentId)
  const conversation = await getConversation(conversationId)


  // MOCK AI 
  if (agent.config.type == 'mock-agent') {
    // Last opp en eller flere filer mock mock
    
  }
  // MISTRAL
  if (agent.config.type == 'mistral-conversation') {
    if (!conversation.vectorStoreId) {
      throw new Error('Conversation does not have a vectorStoreId to upload files to');
    }
    // Last opp en eller flere filer mistral
    const response = await uploadDocumentsToMistralLibrary(conversation.vectorStoreId, body.getAll('files[]') as File[], streaming);

    return new Response(response, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }
  // OPENAI
  if (agent.config.type == 'openai-response') {
    // Last opp en eller flere filer openai
    const { vectorStoreId, readableStream } = await uploadDocumentsToOpenAIVectorStore(conversation.relatedConversationId, conversation.vectorStoreId, body.getAll('files[]') as File[], streaming);
    // Check if vectorStoreId has changed and update conversation if needed
    if (vectorStoreId !== conversation.vectorStoreId) {
      // Oppdater conversation i DB med ny vectorStoreId
      console.log(`Vector store ID changed for conversation ${conversationId}, updating to ${vectorStoreId}`);
      await updateConversation(conversationId, { vectorStoreId });
    }
    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    })
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}
