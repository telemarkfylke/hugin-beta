import { json, type RequestHandler } from "@sveltejs/kit"
import { createAgent, getDBAgent } from "$lib/server/agents/agents.js"
import { deleteDBConversation, getDBConversations, insertDBConversation, updateDBConversation } from "$lib/server/agents/conversations.js"
import { responseStream } from "$lib/streaming"
import { ConversationRequest } from "$lib/types/requests"

// OBS OBS Kan hende vi bare skal ha dette endepunktet - og dersom man ikke sender med en conversationId så oppretter vi en ny conversation, hvis ikke fortsetter vi den eksisterende (ja, kan fortsatt kanskje hende det)

export const GET: RequestHandler = async ({ params }): Promise<Response> => {
	// Da spør vi DB om å hente conversations som påkaller har tilgang på i denne assistenten
	if (!params.agentId) {
		throw new Error("agentId is required")
	}
	console.log(`Fetching conversations for agent ${params.agentId}`)
	const conversations = await getDBConversations(params.agentId)

	return json({ conversations })
}

export const POST: RequestHandler = async ({ request, params }) => {
	const { agentId } = params
	if (!agentId) {
		return json({ error: "agentId is required" }, { status: 400 })
	}

	const body = await request.json()
	// Validate request body
	const { prompt, stream } = ConversationRequest.parse(body)

	const dbAgent = await getDBAgent(agentId)

	const agent = createAgent(dbAgent)

	// Oppretter en conversation i egen db
	const dbConversation = await insertDBConversation(agentId, {
		name: "New Conversation",
		vendorId: dbAgent.vendorId,
		description: "Conversation started via API",
		vendorConversationId: "",
		vectorStoreId: null
	})

	try {
		const { vendorConversationId, response, vectorStoreId } = await agent.createConversation(dbConversation, prompt, stream)

		// Oppdaterer vår conversation med riktig relatedConversationId og vectorStoreId
		updateDBConversation(dbConversation._id, {
			vendorConversationId,
			vectorStoreId
		})

		if (stream) {
			return responseStream(response)
		}

		throw new Error("Non-streaming create conversation not implemented yet")
	} catch (error) {
		console.error("Error creating conversation:", error)
		// delete the conversation we just created in db
		await deleteDBConversation(dbConversation._id)
		throw error
	}
}
