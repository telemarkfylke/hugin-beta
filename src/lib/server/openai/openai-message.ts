import type { ConversationItem } from "openai/resources/conversations.js"
import type { Message } from "$lib/types/message"

export const createMessageFromOpenAIMessage = (openaiMessage: ConversationItem): Message => {
	if (!openaiMessage.id) {
		console.warn("OpenAI message without id:", openaiMessage)
		openaiMessage.id = "no-openai-id?"
	}
	switch (openaiMessage.type) {
		case "message":
			return {
				id: openaiMessage.id,
				role: openaiMessage.role === "user" ? "user" : "agent", // OIOI, her er det flere typer enn bare user og assistant altså
				status: openaiMessage.status, // FÅr vel lage våre egne statuser her kanskje?
				type: "message",
				content: openaiMessage.content.map((contentPart) => {
					switch (contentPart.type) {
						case "text":
							return { type: "text", text: contentPart.text }
						case "input_text":
							return { type: "text", text: contentPart.text }
						case "output_text":
							return { type: "text", text: contentPart.text }
						case "input_image":
							return { type: "image", imageUrl: contentPart.image_url || "unknown image URL" }
						case "input_file":
							return { type: "file", fileUrl: contentPart.file_url || contentPart.file_data || "unknown file URL", fileName: contentPart.filename || "unknown file name" }
						default:
							return { type: "text", text: `Unsupported content part type: ${contentPart.type}: ${JSON.stringify(contentPart)}` }
					}
				})
			}
		default: {
			return {
				id: openaiMessage.id,
				role: "agent",
				status: "completed",
				type: "message",
				content: [
					{
						type: "text",
						text: `Unsupported OpenAI message type: ${openaiMessage.type}: ${JSON.stringify(openaiMessage)}`
					}
				]
			}
		}
	}
}
