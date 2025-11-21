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

/*

	// MOCK AI
	if (agent.config.type === "mock-agent") {
		console.log("Mock AI response for agent:", agent._id)
		if (stream) {
			const readableStream = handleMockAiStream(conversation._id)
			return responseStream(readableStream)
		}
		throw new Error("Mock AI agent only supports streaming responses for now...")
	}
	// MISTRAL
	if (agent.config.type === "mistral-conversation") {
		// Må sjekke at conversations finnes forsatt og...
		console.log("Appending Mistral conversation for agent:", agent._id)
		if (stream) {
			const mistralStream = (await appendToMistralConversation(conversation.relatedConversationId, prompt, true)) as EventStream<ConversationEvents>
			const readableStream = handleMistralStream(mistralStream)

			return responseStream(readableStream)
		}
		const response = await appendToMistralConversation(conversation.relatedConversationId, prompt, false)

		return json({ response })
	}
	// OPENAI
	if (agent.config.type === "openai-response") {
		// Opprett conversation mot OpenAI her og returner
		console.log("Appending OpenAI conversation for agent:", agent._id)

		try {
			const openAIResponse = await appendToOpenAIConversation(agent.config, conversation.relatedConversationId, prompt, conversation.vectorStoreId, stream)
			console.log("Received OpenAI response:", openAIResponse)
			if (stream) {
				console.log("Handling OpenAI streaming response")
				const readableStream = handleOpenAIStream(openAIResponse as Stream<ResponseStreamEvent>)

				console.log("Returning streaming response", readableStream)
				return responseStream(readableStream)
			}
			return json(openAIResponse)
		} catch (error) {
			console.error("Error appending to OpenAI conversation:", error)
			return json({ error: "Failed to get response from OpenAI" }, { status: 500 })
		}
	}

	// OLLAMA
	if (agent.config.type === "ollama-response") {
		const ollamaResponse = await appendToOllamaConversation(agent.config, conversation, prompt, stream)
		if (stream) {
			const readableStream = handleOllamaStream(conversation, ollamaResponse as AbortableAsyncIterator<ChatResponse>, conversation._id)

			return responseStream(readableStream)
		}
		return json({ conversation: conversation, initialResponse: (ollamaResponse as ChatResponse).message })
	}
	throw new Error(`Unsupported agent config type: ${agent.config}`)
}
	*/
