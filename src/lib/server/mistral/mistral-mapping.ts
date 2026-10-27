import type { ConversationResponse, ConversationUsageInfo, InputEntries, MessageInputEntry, MessageOutputEntry } from "@mistralai/mistralai/models/components"
import { logger } from "@vestfoldfylke/loglady"
import type { ChatConfig, ChatResponseObject, ChatResponseUsage } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatOutputItem, ChatOutputMessage } from "$lib/types/chat-item"

const chatInputMessageToMistralInputMessage = (inputItem: ChatInputMessage): MessageInputEntry => {
	const mistralItem: MessageInputEntry = {
		type: "message.input",
		role: "user",
		content: []
	}
	if (typeof mistralItem.content === "string") {
		throw new Error("Mistral message input content should not be a string")
	}
	for (const contentItem of inputItem.content) {
		switch (contentItem.type) {
			case "input_text": {
				mistralItem.content.push({
					type: "text",
					text: contentItem.text
				})
				break
			}
			case "input_file": {
				mistralItem.content.push({
					type: "document_url",
					documentUrl: contentItem.fileUrl,
					documentName: contentItem.fileName
				})
				break
			}
			case "input_image": {
				mistralItem.content.push({
					type: "image_url",
					imageUrl: contentItem.imageUrl
				})
				break
			}
		}
	}
	return mistralItem
}

const chatOutputMessageToMistralOutputMessage = (outputItem: ChatOutputMessage): MessageOutputEntry => {
	const mistralItem: MessageOutputEntry = {
		// id: outputItem.id,
		type: "message.output",
		role: outputItem.role,
		content: []
	}
	if (typeof mistralItem.content === "string") {
		throw new Error("Mistral message output content should not be a string")
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "output_text": {
				mistralItem.content.push({
					type: "text",
					text: contentItem.text
				})
				break
			}
			case "output_refusal": {
				mistralItem.content.push({
					type: "text",
					text: contentItem.reason
				})
				break
			}
		}
	}
	return mistralItem
}

export const chatInputToMistralInput = (inputItem: ChatInputItem): InputEntries => {
	switch (inputItem.type) {
		case "message.input": {
			return chatInputMessageToMistralInputMessage(inputItem)
		}
		case "message.output": {
			return chatOutputMessageToMistralOutputMessage(inputItem)
		}
		default: {
			throw new Error(`Unsupported ChatInputItem: ${JSON.stringify(inputItem)}`)
		}
	}
}

const mistralOutputMessageToChatOutputMessage = (outputItem: MessageOutputEntry): ChatOutputMessage => {
	const chatOutputItem: ChatOutputMessage = {
		id: outputItem.id || `mistral_missing_id_${Date.now()}`,
		type: "message.output",
		role: "assistant",
		content: []
	}
	console.log("Mistral Output Item:", outputItem)
	if (typeof outputItem.content === "string") {
		chatOutputItem.content.push({
			type: "output_text",
			text: outputItem.content
		})
		return chatOutputItem
	}
	for (const contentItem of outputItem.content) {
		switch (contentItem.type) {
			case "text": {
				chatOutputItem.content.push({
					type: "output_text",
					text: contentItem.text
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

const MistralOutputToChatOutput = (outputItem: ConversationResponse["outputs"][number]): ChatOutputItem => {
	switch (outputItem.type) {
		case "message.output": {
			return mistralOutputMessageToChatOutputMessage(outputItem)
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
						text: `Unsupported output item from Mistral: ${outputItem.type}`
					}
				]
			}
		}
	}
}

// Connectors (web_search etc.) are billed per call, and their tokens may not be in promptTokens - counted
// as input here so they're never free; at worst that counts them twice.
export const usageFromMistral = (usage: ConversationUsageInfo | null | undefined): ChatResponseUsage => {
	const connectorTokens = usage?.connectorTokens || 0
	const webSearchCalls = Object.values(usage?.connectors ?? {}).reduce((sum, calls) => sum + calls, 0)
	return {
		inputTokens: (usage?.promptTokens || 0) + connectorTokens,
		outputTokens: usage?.completionTokens || 0,
		totalTokens: (usage?.totalTokens || 0) + connectorTokens,
		...(webSearchCalls > 0 ? { webSearchCalls } : {})
	}
}

export const mistralResponseToChatResponseObject = (config: ChatConfig, response: ConversationResponse): ChatResponseObject => {
	return {
		id: response.conversationId,
		config,
		type: "chat_response",
		createdAt: new Date().toISOString(),
		outputs: response.outputs.map(MistralOutputToChatOutput),
		status: "completed",
		usage: usageFromMistral(response.usage)
	}
}
