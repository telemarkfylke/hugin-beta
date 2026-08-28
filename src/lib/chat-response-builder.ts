import type { ChatResponseObject } from "$lib/types/chat"
import type { ChatOutputMessage } from "$lib/types/chat-item"
import type { MuginSse } from "$lib/types/streaming"

export const addMessageDeltaToChatItem = (chatResponseObject: ChatResponseObject, itemId: string, messageDelta: string): ChatOutputMessage => {
	if (!chatResponseObject?.outputs || !Array.isArray(chatResponseObject.outputs)) {
		throw new Error("No chatResponseObject.outputs to add message delta to")
	}
	if (!itemId) {
		throw new Error("No message ID provided for agent message delta")
	}
	if (!messageDelta) {
		throw new Error("No message delta content provided")
	}
	let outputMessage = chatResponseObject.outputs.find((output) => output.type === "message.output" && output.id === itemId) as ChatOutputMessage | undefined
	if (!outputMessage) {
		outputMessage = {
			id: itemId,
			type: "message.output",
			role: "assistant",
			content: [
				{
					type: "output_text",
					text: ""
				}
			]
		}
		chatResponseObject.outputs.push(outputMessage)
	}
	const messageContent = outputMessage.content[0] // Since we create it ourselves above, it's the first one (for now at least...)
	if (!messageContent || messageContent.type !== "output_text") {
		throw new Error("Agent message content is not of type output_text - what? Devs messed up")
	}
	messageContent.text += messageDelta
	return outputMessage
}

/**
 * Applies one SSE event to a ChatResponseObject being built up incrementally.
 * Shared between the client (consuming the stream live) and the server (capturing
 * a teed copy of the same stream to persist the finished response) so the two never drift.
 *
 * "conversation.created" (the vendor's own conversation id) is intentionally NOT handled
 * here - that's client chat-state (chat.config.conversationId), not part of the response object.
 */
export const applyChatSseEventToResponseObject = (chatResponseObject: ChatResponseObject, event: MuginSse): void => {
	switch (event.event) {
		case "response.started": {
			chatResponseObject.id = event.data.responseId
			chatResponseObject.status = "in_progress"
			break
		}
		case "response.output_text.delta": {
			addMessageDeltaToChatItem(chatResponseObject, event.data.itemId, event.data.content)
			break
		}
		case "response.searching": {
			chatResponseObject.status = "searching"
			break
		}
		case "response.done": {
			chatResponseObject.status = "completed"
			chatResponseObject.usage = event.data.usage
			break
		}
		case "response.annotations": {
			const outputMessage = chatResponseObject.outputs.find((o) => o.type === "message.output" && o.id === event.data.itemId)
			if (outputMessage?.type === "message.output" && outputMessage.content[0]?.type === "output_text") {
				const existing = outputMessage.content[0].annotations ?? []
				outputMessage.content[0].annotations = [...existing, ...event.data.annotations]
			}
			break
		}
		case "response.error": {
			addMessageDeltaToChatItem(chatResponseObject, `error_${Date.now()}`, `\n\n[Error: ${event.data.message}]`)
			chatResponseObject.status = "failed"
			break
		}
		default: {
			break
		}
	}
}
