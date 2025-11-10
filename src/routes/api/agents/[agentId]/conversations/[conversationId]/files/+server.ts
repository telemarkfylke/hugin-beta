import { json } from "@sveltejs/kit"
import { handleMistralStream, appendToMistralConversation, appendToMistralConversationStream } from "$lib/mistral/mistral.js";
import { handleOpenAIStream, appendToOpenAIConversation, appendToOpenAIConversationStream } from "$lib/openai/openai.js";
import { getAgent } from "$lib/agents/agents.js";
import { getConversation } from "$lib/agents/conversations.js";
import { handleMockAiStream } from "$lib/mock-ai/mock-ai.js";

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
    // Last opp en eller flere filer mock mock
  }
  // MISTRAL
  if (agent.config.type == 'mistral-conversation') {
    // Last opp en eller flere filer mistral
  }
  // OPENAI
  if (agent.config.type == 'openai-prompt') {
    // Last opp en eller flere filer openai
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}
