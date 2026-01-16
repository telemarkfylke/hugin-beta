import z from "zod"
import type { ChatInputItem, ChatOutputItem } from "./chat-item"
import type { AppConfig } from "./app-config"

export type VendorId = keyof AppConfig["VENDORS"]

export type VendorAgent = {
	id: string
}

export type ChatTool = {
	type: "tools_not_implemented_yet"
}

export type ChatConfig = {
	_id: string
	name: string
	description: string
	vendorId: VendorId
	project: string
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
	_id: string
	config: ChatConfig
	history: ChatHistory
	createdAt: string
	updatedAt: string
	owner: {
		id: string
		name?: string
	}
}

/**
 *
 * @link https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */

export const schemaForType =
	<T>() =>
	// biome-ignore lint: Unexpected any
	<S extends z.ZodType<T, any>>(arg: S) => {
		return arg
	}

// New and better
export const ChatConfigSchema = schemaForType<ChatConfig>()(
	z.object({
		_id: z.string(),
		name: z.string(),
		description: z.string(),
		vendorId: z.enum(["MISTRAL", "OPENAI", "OLLAMA"]), // Update as per AppConfig Vendor keys for now
		project: z.string(),
		vendorAgent: z.object({ id: z.string() }).optional(),
		model: z.string().optional(),
		instructions: z.string().optional(),
		conversationId: z.string().optional()
	})
)
