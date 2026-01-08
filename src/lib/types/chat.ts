import type { ChatInputItem, ChatOutputItem } from "./chat-item"

export type VendorAgent = {
	id: string
}

export type ChatTool = {
	type: "tools_not_implemented_yet"
}

export type ChatConfig = {
	id: string
	name: string
	description: string
	vendorId: string
	vendorAgent?: VendorAgent | undefined
	model?: string | undefined
	instructions?: string | undefined
	conversationId?: string | undefined
	tools?: ChatTool[]
}

export type ChatRequest = {
	config: ChatConfig
	inputs: ChatInputItem[]
	store?: boolean
	stream?: boolean
}

export type ChatResponseStream = ReadableStream<Uint8Array>

export type ChatResponseUsage = {
	inputTokens: number
	outputTokens: number
	totalTokens: number
}

export type ChatResponseObject = {
	id: string
	type: "chat_response"
	config: ChatConfig
	createdAt: string
	outputs: ChatOutputItem[]
	status: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete"
	usage: ChatResponseUsage
}

export type ChatResponse = ChatResponseStream | ChatResponseObject

export type ChatHistoryItem = ChatInputItem | ChatResponseObject

export type ChatHistory = ChatHistoryItem[]

export type Chat = {
	id: string
	config: ChatConfig
	history: ChatHistory
	createdAt: string
	updatedAt: string
	owner: {
		id: string
		name?: string
	}
}
