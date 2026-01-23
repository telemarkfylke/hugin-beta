import z from "zod"
import { ChatConfigSchema } from "./chat"

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
