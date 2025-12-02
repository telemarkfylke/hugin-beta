import z from "zod"

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

const MessageRoles = z.enum(["user", "agent", "developer", "system"])

export const AdvancedAgentPrompt = z.object({
	role: MessageRoles,
	input: z.array(AdvancedAgentPromptInput).min(1, "Advanced prompt must have at least one input item")
})

export type AdvancedAgentPrompt = z.infer<typeof AdvancedAgentPrompt>

export const AgentPrompt = z.string().min(1, "Prompt cannot be empty").or(z.array(AdvancedAgentPrompt).min(1, "At least one prompt is required"))

export type AgentPrompt = z.infer<typeof AgentPrompt>

// Message (coupled with Prompt for consistency)
const TextMessageContent = TextPrompt
const ImageMessageContent = ImagePrompt
const FileMessageContent = FilePrompt

export const MessageContent = z.discriminatedUnion("type", [TextMessageContent, ImageMessageContent, FileMessageContent])

export type MessageContent = z.infer<typeof MessageContent>

// MESSAGE TYPES
export const Message = z.object({
	id: z.string(),
	type: z.enum(["message"]),
	status: z.string(),
	role: MessageRoles, // Legg inn flere ved behov (f. eks developer)
	content: z.array(MessageContent)
})

export type Message = z.infer<typeof Message>
