import type { ObjectId } from "mongodb"
import z from "zod"
import type { AppConfig } from "./app-config"
import type { ChatInputItem, ChatOutputItem } from "./chat-item"

export type VendorId = keyof AppConfig["VENDORS"]

export type VendorAgent = {
	id: string
}

export type ChatTool = {
	type: "web_search" | "datasource"
}

export type DataSource = {
	type: "ragservice"
	id: string
}

export type RoleAccessGroups = "all" | "employee" | "edu_employee" | "student"
export type EntraAccessGroup = {
	id: string
	displayName: string
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
	tools?: ChatTool[] | undefined | null
	dataSources?: DataSource[] | undefined | null
	type: "published" | "private"
	shared?: boolean | undefined
	// Independent of type/shared - lets an anonymous visitor use this config via /public/embed/**,
	// with no login and no listing anywhere. See $lib/authorization.canSetAnonymousEmbed (admin-only).
	allowAnonymousEmbed?: boolean | undefined
	// Author-defined categories for write-time question statistics (see $lib/statsstore/types). Empty/unset
	// means the feature is off for this bot - no categorization call is made per question. Every
	// incoming user question is classified into exactly one of these (or "Ukategorisert" as a fallback
	// when none fit), never shown to the end user, purely for aggregate stats - never per-person.
	categories?: string[] | undefined | null
	// A/B flag, public embed route only (see embed/api/chat/+server.ts) - never read by supahChat.
	// true: pre-classifies each question (category + scope, one utility-model call - see
	// classifyQuestion) BEFORE answering, and refuses out-of-scope questions instead of forwarding
	// them to the vendor. false/unset (default): behaves exactly like supahChat always has - fire-
	// and-forget post-hoc category stats only (recordQuestionCategoryStat), no scope check, nothing
	// ever blocked. Meant to be flipped per bot to compare guardrails-on vs guardrails-off in
	// practice, not as a permanent per-bot setting.
	scopeGuardEnabled?: boolean | undefined
	// A/B flag, public embed route only, independent of scopeGuardEnabled above (separate switches
	// so combinations of the two can be compared, not just "guardrails" as one bundle). true: when
	// this bot has RAG datasources configured and a search returns zero relevant chunks, refuse
	// instead of forwarding the question to the vendor with no grounding - see the empty-RAG-result
	// guard in embed/api/chat/+server.ts. false/unset (default): unchanged - the vendor answers from
	// its own general knowledge whenever nothing relevant was found. No-op for a bot with no RAG
	// datasources at all (nothing to have "zero results" from).
	emptyRagGuardEnabled?: boolean | undefined
	accessGroups: (RoleAccessGroups | EntraAccessGroup)[]
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
	huginConversationId?: string | undefined
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
	status: "completed" | "failed" | "in_progress" | "cancelled" | "queued" | "incomplete" | "searching"
	usage: ChatResponseUsage
}

export type ChatResponse = ChatResponseStream | ChatResponseObject

export type ChatHistoryItem = ChatInputItem | ChatResponseObject

export type ChatHistory = ChatHistoryItem[]

export type Chat = {
	_id: string
	title?: string | undefined
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
		vendorId: z.enum(["MISTRAL", "OPENAI", "OLLAMA", "LITELLM"]), // Update as per AppConfig Vendor keys for now
		project: z.string(),
		vendorAgent: z.object({ id: z.string() }).optional(),
		model: z.string().optional(),
		tools: z
			.array(z.object({ type: z.enum(["web_search", "datasource"]) }))
			.nullable()
			.optional(),
		dataSources: z
			.array(z.object({ type: z.enum(["ragservice"]), id: z.string() }))
			.nullable()
			.optional(), // Update as per ChatTool for now
		shared: z.boolean().optional(),
		allowAnonymousEmbed: z.boolean().optional(),
		categories: z.array(z.string()).nullable().optional(),
		scopeGuardEnabled: z.boolean().optional(),
		emptyRagGuardEnabled: z.boolean().optional(),
		instructions: z.string().optional(),
		conversationId: z.string().optional(),
		type: z.enum(["published", "private"]), // Update as per ChatConfig for now
		accessGroups: z.array(z.union([z.literal("all"), z.literal("employee"), z.literal("edu_employee"), z.literal("student"), z.object({ id: z.string(), displayName: z.string() })])),
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
