import { logger } from "@vestfoldfylke/loglady"
import type { Response } from "openai/resources/responses/responses.js"
import type { EasyInputMessage, ResponseInputItem, ResponseOutputItem, ResponseOutputMessage } from "openai/resources/responses/responses.mjs"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatOutputItem, ChatOutputMessage } from "$lib/types/chat-item"

const chatInputMessageToOpenAIInputMessage = (inputItem: ChatInputMessage): ResponseInputItem.Message => {
	const openAIItem: ResponseInputItem.Message = {
		type: "message",
		role: inputItem.role,
		content: []
	}
	for (const contentItem of inputItem.content) {
		switch (contentItem.type) {
			case "input_text": {
				openAIItem.content.push(contentItem)
				break
			}
			case "input_file": {
				openAIItem.content.push({
					type: "input_file",
					file_data: contentItem.fileUrl,
					filename: contentItem.fileName
				})
				break
			}
			case "input_image": {
				openAIItem.content.push({
					type: "input_image",
					image_url: contentItem.imageUrl,
					detail: "auto"
				})
				break
			}
		}
	}
	return openAIItem
}

// Replays a past assistant turn as plain {role, content} - the EasyInputMessage shape, not a
// full ResponseOutputMessage. outputItem.id is our own internal id, not necessarily one OpenAI
// ever issued (it may come from another vendor after a mid-conversation switch, from Hugin's own
// synthetic error/unsupported-output placeholders, or from a stored conversation loaded back in).
// Hugin always calls OpenAI with store: false (see openai-vendor.ts), so OpenAI never needs that id
// for its own continuity - but it does validate it when present, so a foreign/fabricated id gets
// the request rejected. Every subsequent request replays the same poisoned history in incognito
// mode, permanently breaking the conversation. Dropping id/status/type here keeps the content
// (context is preserved) while removing the field OpenAI has no way to recognize.
const chatOutputMessageToOpenAIEasyInputMessage = (outputItem: ChatOutputMessage): EasyInputMessage => {
	const textParts: string[] = []
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				textParts.push(contentItem.text)
				break
			}
			case "output_refusal": {
				textParts.push(contentItem.reason)
				break
			}
		}
	}
	return {
		role: outputItem.role,
		content: textParts.join("\n")
	}
}

export const chatInputToOpenAIInput = (inputItem: ChatInputItem): ResponseInputItem => {
	switch (inputItem.type) {
		case "message.input": {
			return chatInputMessageToOpenAIInputMessage(inputItem)
		}
		case "message.output": {
			return chatOutputMessageToOpenAIEasyInputMessage(inputItem)
		}
		default: {
			throw new Error(`Unsupported ChatInputItem: ${JSON.stringify(inputItem)}`)
		}
	}
}

const openAIChatOutputMessageToChatOutputMessage = (outputItem: ResponseOutputMessage): ChatOutputMessage => {
	const chatOutputItem: ChatOutputMessage = {
		id: outputItem.id,
		type: "message.output",
		role: "assistant",
		content: []
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				const urlCitations = contentItem.annotations.filter((a) => a.type === "url_citation")
				chatOutputItem.content.push({
					type: "output_text",
					text: contentItem.text,
					...(urlCitations.length > 0 && {
						annotations: urlCitations.map((a) => ({
							type: "url_citation" as const,
							url: a.url,
							title: a.title,
							startIndex: a.start_index,
							endIndex: a.end_index
						}))
					})
				})
				break
			}
			case "refusal": {
				chatOutputItem.content.push({
					type: "output_refusal",
					reason: contentItem.refusal
				})
				break
			}
			default: {
				logger.warn("Unsupported OpenAI OutputItem Content: {@contentItem}", contentItem)
			}
		}
	}
	return chatOutputItem
}

const openAIOutputToChatOutput = (outputItem: ResponseOutputItem): ChatOutputItem => {
	switch (outputItem.type) {
		case "message": {
			return openAIChatOutputMessageToChatOutputMessage(outputItem)
		}
		default: {
			logger.warn("Unsupported OpenAI OutputItem: {@outputItem}", outputItem)
			return {
				id: `unsupported_output_${Date.now()}`,
				type: "message.output",
				role: "assistant",
				content: [
					{
						type: "output_text",
						text: `Unsupported output item from OpenAI: ${outputItem.type}`
					}
				]
			}
		}
	}
}

export const openAiResponseToChatResponseObject = (config: ChatConfig, response: Response): ChatResponseObject => {
	return {
		id: response.id,
		config,
		type: "chat_response",
		createdAt: new Date(response.created_at).toISOString(),
		outputs: response.output.map(openAIOutputToChatOutput),
		status: response.status || "incomplete",
		usage: {
			inputTokens: response.usage?.input_tokens || 0,
			outputTokens: response.usage?.output_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0
		}
	}
}
