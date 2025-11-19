import { json } from "@sveltejs/kit"
import { getAgent } from "$lib/server/agents/agents.js";
import { getConversation, updateConversation } from "$lib/server/agents/conversations.js";
import { uploadFilesToMistralLibrary } from "$lib/server/mistral/document-library.js";
import { uploadFilesToOpenAIVectorStore } from "$lib/server/openai/vector-store.js";
import { uploadFilesToMockAI, getMockAiFiles } from "$lib/server/mock-ai/mock-ai-files.js";
import { responseStream } from "$lib/streaming.js";

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const GET = async ({ params }) => {
  const { conversationId, agentId } = params
  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, { status: 400 })
  }

  const agent = await getAgent(agentId)
  // const conversation = await getConversation(conversationId)

  // Mock AI
  if (agent.config.type === 'mock-agent') {
    const mockFiles = await getMockAiFiles()
    return json(mockFiles)
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}

/**
 *
 * @type {import("@sveltejs/kit").RequestHandler}
 */
export const POST = async ({ request, params }) => {
  // Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
  const { conversationId, agentId } = params
  if (!agentId || !conversationId) {
    return json({ error: 'agentId and conversationId are required' }, { status: 400 })
  }
  const body = await request.formData()
  const files: File[] = body.getAll('files[]') as File[]
  const streamParam = body.get('stream')
  if (!streamParam || (streamParam !== 'true' && streamParam !== 'false')) {
    return json({ error: 'stream parameter is required and must be either "true" or "false"' }, { status: 400 })
  }
  const stream: boolean = streamParam === 'true'

  // Validate files
  if (!files || files.length === 0) {
    return json({ error: 'No files provided for upload' }, { status: 400 })
  }
  const agent = await getAgent(agentId)
  const conversation = await getConversation(conversationId)

  // Validate file types
  const allFilesValid = files.every(file => {
    if (!(file instanceof File)) {
      return false;
    }
    /* Må komme fra agent ellerno
    const validTypes = [];
    return validTypes.includes(file.type);
    */
    return true; // For now, aksepter alle typer
  })
  if (!allFilesValid) {
    return json({ error: 'One or more files have invalid type' }, { status: 400 }) // Add valid types message senere
  }

  // MOCK AI 
  if (agent.config.type === 'mock-agent') {
    // Last opp en eller flere filer mock mock
    const response = await uploadFilesToMockAI(conversation.vectorStoreId || 'mock-library-id', files, stream)

    return responseStream(response)
  }
  // MISTRAL
  if (agent.config.type === 'mistral-conversation') {
    if (!conversation.vectorStoreId) {
      throw new Error('Conversation does not have a vectorStoreId to upload files to');
    }
    // Last opp en eller flere filer mistral
    const response = await uploadFilesToMistralLibrary(conversation.vectorStoreId, files, stream);
    return responseStream(response)
  }
  // OPENAI
  if (agent.config.type === 'openai-response') {
    // Last opp en eller flere filer openai
    const { vectorStoreId, readableStream } = await uploadFilesToOpenAIVectorStore(conversation.relatedConversationId, conversation.vectorStoreId, files, stream);
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
