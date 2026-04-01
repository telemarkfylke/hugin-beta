import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatOutputMessage } from "$lib/types/chat-item"

const chatInputMessageToCompletionMessage = (item: ChatInputMessage): ChatCompletionMessageParam => {
	const role = item.role === "developer" ? "system" : item.role

	const textParts = item.content.filter((c) => c.type === "input_text")
	const imageParts = item.content.filter((c) => c.type === "input_image")

	if (imageParts.length === 0) {
		return {
			role,
			content: textParts.map((c) => c.text).join("\n")
		}
	}

	return {
		role: role === "system" ? "user" : role, // system role doesn't support image content parts
		content: [...textParts.map((c) => ({ type: "text" as const, text: c.text })), ...imageParts.map((c) => ({ type: "image_url" as const, image_url: { url: c.imageUrl } }))]
	}
}

const chatOutputMessageToCompletionMessage = (item: ChatOutputMessage): ChatCompletionMessageParam => {
	const textParts = item.content.filter((c) => c.type === "output_text").map((c) => c.text)
	return {
		role: "assistant",
		content: textParts.join("\n")
	}
}

export const chatInputToCompletionMessage = (item: ChatInputItem): ChatCompletionMessageParam => {
	switch (item.type) {
		case "message.input":
			return chatInputMessageToCompletionMessage(item)
		case "message.output":
			return chatOutputMessageToCompletionMessage(item)
		default:
			throw new Error(`Unsupported ChatInputItem type: ${JSON.stringify(item)}`)
	}
}

export const litellmResponseToChatResponseObject = (config: ChatConfig, response: ChatCompletion): ChatResponseObject => {
	return {
		id: response.id,
		config,
		type: "chat_response",
		createdAt: new Date(response.created * 1000).toISOString(),
		outputs: [
			{
				id: crypto.randomUUID(),
				type: "message.output",
				role: "assistant",
				content: [
					{
						type: "output_text",
						text: response.choices[0]?.message?.content ?? ""
					}
				]
			}
		],
		status: "completed",
		usage: {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
			totalTokens: response.usage?.total_tokens ?? 0
		}
	}
}
