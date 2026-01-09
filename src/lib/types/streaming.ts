import z from "zod"
import type { ChatConfig } from "./chat";

/**
 * 
 * @link https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */
// biome-ignore lint: Unexpected any
const schemaForType = <T>() => <S extends z.ZodType<T, any>>(arg: S) => {
  return arg;
};

// New and better
const ChatConfigSchema = schemaForType<ChatConfig>()(
	z.object({
		id: z.string(),
		name: z.string(),
		description: z.string(),
		vendorId: z.string(),
		vendorAgent: z.object({ id: z.string() }).optional(),
		model: z.string().optional(),
		instructions: z.string().optional(),
		conversationId: z.string().optional(),
	})
)

const ResponseConfig = z.object({
	event: z.literal("response.config"),
	data: ChatConfigSchema
})

const ResponseStarted = z.object({
	event: z.literal("response.started"),
	data: z.object({
		responseId: z.string()
	})
})

const ResponseDone = z.object({
	event: z.literal("response.done"),
	data: z.object({
		usage: z.object({
			inputTokens: z.number(),
			outputTokens: z.number(),
			totalTokens: z.number()
		})
	})
})

const ResponseError = z.object({
	event: z.literal("response.error"),
	data: z.object({
		code: z.string(),
		message: z.string()
	})
})

const ResponseOutputTextDelta = z.object({
	event: z.literal("response.output_text.delta"),
	data: z.object({
		// Hva brukes content part til egt?
		itemId: z.string(),
		content: z.string()
	})
})

const ConversationCreated = z.object({
	event: z.literal("conversation.created"),
	data: z.object({
		conversationId: z.string()
	})
})

export const MuginSse = z.discriminatedUnion("event", [
	// New events
	ResponseConfig,
	ResponseStarted,
	ResponseDone,
	ResponseError,
	ResponseOutputTextDelta,
	ConversationCreated
])

export type MuginSse = z.infer<typeof MuginSse>
