import type { ChatResponse, Message } from "ollama"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatOutputMessage } from "$lib/types/chat-item"

const chatInputMessageToOllamaMessage = (item: ChatInputMessage): Message => {
	const textParts = item.content.filter((c) => c.type === "input_text").map((c) => c.text)
	const imageParts = item.content.filter((c) => c.type === "input_image").map((c) => c.imageUrl)

	const role = item.role === "developer" ? "system" : item.role

	return {
		role,
		content: textParts.join("\n"),
		...(imageParts.length > 0 ? { images: imageParts } : {})
	}
}

const chatOutputMessageToOllamaMessage = (item: ChatOutputMessage): Message => {
	const textParts = item.content.filter((c) => c.type === "output_text").map((c) => c.text)

	return {
		role: "assistant",
		content: textParts.join("\n")
	}
}

export const chatInputToOllamaMessage = (item: ChatInputItem): Message => {
	switch (item.type) {
		case "message.input":
			return chatInputMessageToOllamaMessage(item)
		case "message.output":
			return chatOutputMessageToOllamaMessage(item)
		default:
			throw new Error(`Unsupported ChatInputItem type: ${JSON.stringify(item)}`)
	}
}

export const ollamaResponseToChatResponseObject = (config: ChatConfig, response: ChatResponse, responseId: string): ChatResponseObject => {
	return {
		id: responseId,
		config,
		type: "chat_response",
		createdAt: response.created_at.toISOString(),
		outputs: [
			{
				id: crypto.randomUUID(),
				type: "message.output",
				role: "assistant",
				content: [
					{
						type: "output_text",
						text: response.message.content
					}
				]
			}
		],
		status: response.done ? "completed" : "incomplete",
		usage: {
			inputTokens: response.prompt_eval_count || 0,
			outputTokens: response.eval_count || 0,
			totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
		}
	}
}
