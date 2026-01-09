import { logger } from "@vestfoldfylke/loglady"
import type { Response } from "openai/resources/responses/responses.js"
import type { ResponseInputItem, ResponseOutputItem, ResponseOutputMessage } from "openai/resources/responses/responses.mjs"
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

const chatOutputMessageToOpenAIOutputMessage = (outputItem: ChatOutputMessage): ResponseOutputMessage => {
	const openAIItem: ResponseOutputMessage = {
		id: outputItem.id,
		status: "completed", // Dont care
		type: "message",
		role: outputItem.role,
		content: []
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				openAIItem.content.push({
					type: "output_text",
					annotations: [], // hmmm
					text: contentItem.text
				})
				break
			}
			case "output_refusal": {
				openAIItem.content.push({
					type: "refusal",
					refusal: contentItem.reason
				})
				break
			}
		}
	}
	return openAIItem
}

export const chatInputToOpenAIInput = (inputItem: ChatInputItem): ResponseInputItem => {
	switch (inputItem.type) {
		case "message.input": {
			return chatInputMessageToOpenAIInputMessage(inputItem)
		}
		case "message.output": {
			return chatOutputMessageToOpenAIOutputMessage(inputItem)
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
				chatOutputItem.content.push({
					type: "output_text",
					text: contentItem.text
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
