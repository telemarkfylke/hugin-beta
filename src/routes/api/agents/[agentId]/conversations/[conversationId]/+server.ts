import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { getConversation } from "$lib/server/agents/conversations.js"
import { responseStream } from "$lib/streaming"
import { ConversationRequest, type GetConversationResult } from "$lib/types/requests"

export const GET: RequestHandler = async ({ params }): Promise<Response> => {
	const { conversationId, agentId } = params
	if (!agentId || !conversationId) {
		return json({ error: "agentId and conversationId are required" }, { status: 400 })
	}

	// Først må vi hente conversation fra DB, deretter må vi hente historikken fra leverandør basert på agenten og relatedConversationId - og gi tilbake hele røkla på en felles måte
	const dbAgent = await getDBAgent(agentId)
	const conversation = await getConversation(conversationId)

	// Sikkert kjøre noe authorization

	const agent = createAgent(dbAgent)
	const { messages } = await agent.getConversationMessages(conversation)
	const response: GetConversationResult = {
		conversation,
		items: messages
	}

	return json(response)
}

export const POST: RequestHandler = async ({ request, params }): Promise<Response> => {
	// Da legger vi til en ny melding i samtalen i denne agenten via leverandør basert på agenten, og får tilbake responseStream med oppdatert samtalehistorikk
	const { conversationId, agentId } = params
	if (!agentId || !conversationId) {
		return json({ error: "agentId and conversationId are required" }, { status: 400 })
	}

	const body = await request.json()
	// Validate request body
	const { prompt, stream } = ConversationRequest.parse(body)

	const dbAgent = await getDBAgent(agentId)
	const conversation = await getConversation(conversationId) // HUSK authorization her

	const agent = createAgent(dbAgent)

	const { response } = await agent.appendMessageToConversation(conversation, prompt, stream)

	if (stream) {
		return responseStream(response)
	}

	throw new Error("Non-streaming append message not implemented yet")
}
