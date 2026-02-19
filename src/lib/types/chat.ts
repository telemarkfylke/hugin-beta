import type { ObjectId } from "mongodb"
import z from "zod"
import type { AppConfig } from "./app-config"
import type { ChatInputItem, ChatOutputItem } from "./chat-item"

export type VendorId = keyof AppConfig["VENDORS"]

export type VendorAgent = {
	id: string
}

export type ChatTool = {
	type: "web_search"
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
	tools?: ChatTool[] | undefined
	type: "published" | "private"
	accessGroups: "all" | string[]
	created: {
		at: string
		by: {
			id: string
			name?: string | undefined
		}
	}
	updated: {
		at: string
		by: {
			id: string
			name?: string | undefined
		}
	}
}

export type DbChatConfig = Omit<ChatConfig, "_id"> & { _id: ObjectId }
export type NewChatConfig = Omit<ChatConfig, "_id">

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
		name?: string | undefined
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
		tools: z.array(z.object({ type: z.enum(["web_search"]) })).optional(), // Update as per ChatTool for now
		instructions: z.string().optional(),
		conversationId: z.string().optional(),
		type: z.enum(["published", "private"]), // Update as per ChatConfig for now
		accessGroups: z.union([z.literal("all"), z.array(z.string())]),
		created: z.object({
			at: z.string(),
			by: z.object({
				id: z.string(),
				name: z.string().optional()
			})
		}),
		updated: z.object({
			at: z.string(),
			by: z.object({
				id: z.string(),
				name: z.string().optional()
			})
		})
	})
)
