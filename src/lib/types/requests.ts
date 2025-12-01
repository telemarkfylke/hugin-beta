import z from "zod"
import { Conversation, Message } from "./agents"

// Ta alle datagreier som skal mottas enten i frontend eller backend her

// Prompts
const TextPrompt = z.object({
	type: z.literal("text"),
	text: z.string().min(1, "Text prompt cannot be empty")
})

const ImagePrompt = z.object({
	type: z.literal("image"),
	imageUrl: z.string().min(1, "Image URL cannot be empty")
})

const FilePrompt = z.object({
	type: z.literal("file"),
	fileName: z.string().min(1, "FileName cannot be empty"),
	fileUrl: z.string().min(1, "File URL cannot be empty")
})

export const AdvancedAgentPromptInput = z.discriminatedUnion("type", [TextPrompt, ImagePrompt, FilePrompt])

export type AdvancedAgentPromptInput = z.infer<typeof AdvancedAgentPromptInput>

export const AdvancedAgentPrompt = z.object({
	role: z.enum(["user", "agent", "developer", "system"]),
	input: z.array(AdvancedAgentPromptInput).min(1, "Advanced prompt must have at least one input item")
})

export type AdvancedAgentPrompt = z.infer<typeof AdvancedAgentPrompt>

export const AgentPrompt = z.string().min(1, "Prompt cannot be empty").or(
	z.array(AdvancedAgentPrompt).min(1, "At least one prompt is required")
)

export type AgentPrompt = z.infer<typeof AgentPrompt>

/**
 * Schema for creating a new conversation with an agent
 * POST /api/agents/:agentId/conversations
 */
export const ConversationRequest = z.object({
	prompt: AgentPrompt,
	stream: z.boolean()
})

export type ConversationRequest = z.infer<typeof ConversationRequest>

export const GetConversationResult = z.object({
	conversation: Conversation,
	items: z.array(Message)
})

export type GetConversationResult = z.infer<typeof GetConversationResult>

export const GetConversationsResult = z.object({
	conversations: z.array(Conversation)
})

export type GetConversationsResult = z.infer<typeof GetConversationsResult>

const vectorStoreFileStatusEnum = z.enum(["ready", "processing", "error"])

export type VectorStoreFileStatus = z.infer<typeof vectorStoreFileStatusEnum>

export const VectorStoreFile = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	bytes: z.number(),
	summary: z.string().nullable().optional(),
	status: vectorStoreFileStatusEnum
})

export type VectorStoreFile = z.infer<typeof VectorStoreFile>

export const GetVectorStoreFilesResult = z.object({
	files: z.array(VectorStoreFile)
})

export type GetVectorStoreFilesResult = z.infer<typeof GetVectorStoreFilesResult>
