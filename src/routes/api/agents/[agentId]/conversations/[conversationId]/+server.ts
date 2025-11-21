import { json, type RequestHandler } from "@sveltejs/kit"
//<<<<<<< HEAD
import { handleMistralStream, appendToMistralConversation, getMistralConversationItems } from "$lib/server/mistral/mistral.js";
import { handleOpenAIStream, appendToOpenAIConversation, getOpenAIConversationItems } from "$lib/server/openai/openai.js";
import { handleOllamaStream, appendToOllamaConversation } from "$lib/server/ollama/ollama";
import { getAgent } from "$lib/server/agents/agents.js";
import { getConversation } from "$lib/server/agents/conversations.js";
import { handleMockAiStream } from "$lib/server/mock-ai/mock-ai.js";
import type { EventStream } from "@mistralai/mistralai/lib/event-streams";
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents";
import type { Stream } from "openai/streaming";
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs";
import { ConversationRequest, GetConversationResult } from "$lib/types/requests";
import { responseStream } from "$lib/streaming";

/*//=======
import type { ResponseStreamEvent } from "openai/resources/responses/responses.mjs"
import type { Stream } from "openai/streaming"
import { getAgent } from "$lib/server/agents/agents.js"
import { getConversation } from "$lib/server/agents/conversations.js"
import { appendToMistralConversation, getMistralConversationItems, handleMistralStream } from "$lib/server/mistral/mistral.js"
import { handleMockAiStream } from "$lib/server/mock-ai/mock-ai.js"
import { appendToOpenAIConversation, getOpenAIConversationItems, handleOpenAIStream } from "$lib/server/openai/openai.js"
import { responseStream } from "$lib/streaming"
import { ConversationRequest, type GetConversationResult } from "$lib/types/requests"
//>>>>>>> main*/

export const GET: RequestHandler = async ({ params }): Promise<Response> => {
	const { conversationId, agentId } = params
	if (!agentId || !conversationId) {
		return json({ error: "agentId and conversationId are required" }, { status: 400 })
	}

	// Først må vi hente conversation fra DB, deretter må vi hente historikken fra leverandør basert på agenten og relatedConversationId - og gi tilbake hele røkla på en felles måte
	const agent = await getAgent(agentId)
	const conversation = await getConversation(conversationId)

	// MOCK AI
	if (agent.config.type === "mock-agent") {
		const getConversationResult: GetConversationResult = {
			conversation,
			items: [
				{
					type: "message",
					id: "msg_abc",
					status: "completed",
					role: "user",
					content: { type: "inputText", text: "Hello!" }
				},
				{
					type: "message",
					id: "msg_def",
					status: "completed",
					role: "agent",
					content: { type: "outputText", text: "Hi there! How can I assist you today?" }
				}
			]
		}
		return json(getConversationResult)
	}

	// MISTRAL
	if (agent.config.type === "mistral-conversation" || agent.config.type === "mistral-agent") {
		const items = await getMistralConversationItems(conversation.relatedConversationId)
		const getConversationResult: GetConversationResult = {
			conversation,
			items
		}
		return json(getConversationResult)
	}

	// OPENAI
	if (agent.config.type === "openai-response" || agent.config.type === "openai-prompt") {
		const items = await getOpenAIConversationItems(conversation.relatedConversationId)
		const getConversationResult: GetConversationResult = {
			conversation,
			items
		}
		return json(getConversationResult)
	}

	throw new Error(`Unsupported agent config type: ${agent.config}`)
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

	const agent = await getAgent(agentId)
	const conversation = await getConversation(conversationId)

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
  if (agent.config.type == 'ollama-response'){
    const openAIResponse = await appendToOllamaConversation(agent.config, conversation, prompt, stream);
    if (stream) {
      const readableStream = handleOllamaStream(conversation, openAIResponse, conversation._id);

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      })
    }

    return json({ conversation: conversation, initialResponse: openAIResponse.message })
  }
  throw new Error(`Unsupported agent config type: ${agent.config}`);
}
