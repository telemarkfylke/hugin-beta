import type { AgentHandoffEntry, FunctionCallEntry, FunctionResultEntry, MessageInputEntry, MessageOutputEntry, ToolExecutionEntry } from "@mistralai/mistralai/models/components"
import type { Message } from "$lib/types/message"

type MistralMessage = MessageInputEntry | MessageOutputEntry | AgentHandoffEntry | FunctionCallEntry | FunctionResultEntry | ToolExecutionEntry

const mistralMessageEntryToMessage = (mistralMessage: MessageInputEntry | MessageOutputEntry): Message => {
	if (!mistralMessage.type) {
		throw new Error("Mistral message type is undefined")
	}
	if (!mistralMessage.id) {
		console.warn("Mistral message without id:", mistralMessage)
		mistralMessage.id = "no-mistral-id?"
	}
	return {
		id: mistralMessage.id,
		role: mistralMessage.role === "assistant" ? "agent" : "user",
		status: "completed", // Mistral messages does not have status, so we assume completed
		type: "message",
		content:
			typeof mistralMessage.content === "string"
				? [{ type: "text", text: mistralMessage.content }]
				: mistralMessage.content.map((contentPart) => {
						switch (contentPart.type) {
							case "text":
								return { type: "text", text: contentPart.text }
							case "image_url":
								return { type: "image", imageUrl: typeof contentPart.imageUrl === "string" ? contentPart.imageUrl : contentPart.imageUrl.url }
							case "document_url":
								return { type: "file", fileUrl: contentPart.documentUrl, fileName: contentPart.documentName || "unknown file name" }
							case "thinking":
								return { type: "text", text: JSON.stringify(contentPart) } // No real mapping for thinking, so we just dump the JSON as text for now
							case "tool_file":
								return { type: "text", text: JSON.stringify(contentPart) } // No real mapping for tool_file, so we just dump the JSON as text for now
							default:
								return { type: "text", text: `Unsupported content part type: ${contentPart.type}: ${JSON.stringify(contentPart)}` }
						}
					})
	}
}

export const createMessageFromMistralMessage = (mistralMessage: MistralMessage): Message => {
	if (!mistralMessage.type) {
		throw new Error("Mistral message type is undefined")
	}
	if (!mistralMessage.id) {
		console.warn("Mistral message without id:", mistralMessage)
		mistralMessage.id = "no-mistral-id?"
	}
	switch (mistralMessage.type) {
		case "message.input":
			return mistralMessageEntryToMessage(mistralMessage)
		case "message.output":
			return mistralMessageEntryToMessage(mistralMessage)
		default: {
			return {
				id: mistralMessage.id,
				role: "agent",
				status: "completed",
				type: "message",
				content: [
					{
						type: "text",
						text: `Unsupported Mistral message type: ${mistralMessage.type}: ${JSON.stringify(mistralMessage)}`
					}
				]
			}
		}
	}
}
