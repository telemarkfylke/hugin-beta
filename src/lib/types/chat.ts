import type { ResponseInputItem, ResponseOutputMessage, Tool } from "openai/resources/responses/responses.mjs"

// Steal from OpenAI types (don't want to reinvent the wheel)
export type ChatInputMessage = ResponseInputItem.Message
export type ChatOutputMessage = ResponseOutputMessage

export type ChatTool = Tool

// Done stealing for now

export type UnknownChatItem = {
	type: "unknown"
	data: unknown
}

export type ChatInput = ChatInputMessage | ChatOutputMessage | UnknownChatItem

export type VendorAgent = {
	id: string
}

export type ChatConfig = {
	id?: string
	name?: string
	description?: string
	vendorId: string
	inputs: ChatInput[]
	stream?: boolean
	vendorAgent?: VendorAgent
	model?: string
	instructions?: string
	conversationId?: string
	tools?: ChatTool[]
}

export type ChatResponseStream = ReadableStream<Uint8Array>

export type UsageInfo = {
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

export type ChatOutput = ChatOutputMessage | UnknownChatItem

export type ChatResponseObject = {
	id: string
	type: "chat_response"
	vendorId: string
	createdAt: string
	outputs: ChatOutput[]
	status: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete"
	usage: UsageInfo
}

export type ChatResponse = ChatResponseStream | ChatResponseObject
