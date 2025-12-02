// Keeps track of the entire state of an agent component (async stuff are allowed here)
import { parseSse } from "$lib/streaming.js"
import type { AgentState } from "$lib/types/agent-state"
import type { AgentPrompt } from "$lib/types/message.js"
import type { ConversationRequest } from "$lib/types/requests"
import { _getAgentConversations } from "./AgentConversations.svelte.js"

export const _addUserMessageToConversation = (agentState: AgentState, agentPrompt: AgentPrompt) => {
	console.log("Adding user message to conversation:", agentPrompt)
	agentState.currentConversation.value.messages[Date.now().toString()] = {
		role: "user",
		id: Date.now().toString(),
		status: "completed",
		type: "message",
		content:
			typeof agentPrompt === "string"
				? [
						{
							type: "text",
							text: agentPrompt
						}
					]
				: agentPrompt.flatMap((promptMessage) => promptMessage.input)
	}
}

export const _addAgentMessageDeltaToConversation = (agentState: AgentState, messageId: string, messageDelta: string) => {
	if (!agentState.currentConversation.value.messages[messageId]) {
		agentState.currentConversation.value.messages[messageId] = {
			role: "agent",
			id: messageId,
			status: "in_progress", // TODO handle status updates? and set to completed when done (or error or something)
			type: "message",
			content: [
				{
					type: "text",
					text: ""
				}
			]
		}
	}
	let textContentPart = agentState.currentConversation.value.messages[messageId].content.find((part) => part.type === "text")
	if (!textContentPart) {
		textContentPart = {
			type: "text",
			text: ""
		}
		agentState.currentConversation.value.messages[messageId].content.push(textContentPart)
	}
	textContentPart.text += messageDelta
}

export const _promptAgent = async (agentState: AgentState, userPrompt: AgentPrompt): Promise<void> => {
	if (!agentState.agentId) {
		throw new Error("Agent ID is not set")
	}
	if (!userPrompt || (typeof userPrompt === "string" && userPrompt.trim() === "")) {
		throw new Error("User prompt is empty") // or just return? Or something fancy
	}
	// Reset error state
	agentState.currentConversation.error = null
	// First, add the user message to the conversation immediately
	_addUserMessageToConversation(agentState, userPrompt)
	// Then, prompt the agent and stream the response
	const requestBody: ConversationRequest = {
		prompt: userPrompt,
		stream: true
	}
	const url = agentState.currentConversation.value.id ? `/api/agents/${agentState.agentId}/conversations/${agentState.currentConversation.value.id}` : `/api/agents/${agentState.agentId}/conversations`
	const response = await fetch(url, {
		method: "POST",
		body: JSON.stringify(requestBody)
	})

	if (!response || !response.ok) {
		throw new Error(`Failed when prompting agent: ${response.status}`)
	}
	if (!response.body) {
		throw new Error("Failed to get a response body from agent prompt")
	}
	if (!response.body.getReader) {
		throw new Error("Response body does not support streaming")
	}
	try {
		const reader = response.body.getReader()
		const decoder = new TextDecoder("utf-8")
		while (true) {
			const { value, done } = await reader.read()
			const chatResponseText = decoder.decode(value, { stream: true })
			const chatResponse = parseSse(chatResponseText)
			for (const chatResult of chatResponse) {
				switch (chatResult.event) {
					case "conversation.started": {
						const { conversationId } = chatResult.data
						// Set conversation ID in state as we got a new one
						agentState.currentConversation.value.id = conversationId
						// Trigger a little refresh of conversations list to include the new conversation
						_getAgentConversations(agentState)
						console.log("Conversation started with ID:", conversationId)
						break
					}
					case "conversation.message.delta": {
						const { messageId, content } = chatResult.data
						_addAgentMessageDeltaToConversation(agentState, messageId, content)
						break
					}
					case "conversation.message.ended": {
						console.log("Conversation message ended. Total tokens used:", chatResult.data.totalTokens)
						break
					}
					default: {
						console.warn("Unhandled chat result event:", chatResult.event)
						break
					}
				}
			}
			if (done) break
		}
	} catch (error) {
		agentState.currentConversation.error = error instanceof Error ? error.message : String(error)
		throw error
	}
}
