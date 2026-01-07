import z from "zod"

// New and better
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

const UnknownEvent = z.object({
	event: z.literal("unknown"),
	data: z.unknown()
})

// Old and shitty?
const ConversationStarted = z.object({
	event: z.literal("conversation.started"),
	data: z.object({
		conversationId: z.string()
	})
})

const ConversationMessageDelta = z.object({
	event: z.literal("conversation.message.delta"),
	data: z.object({
		messageId: z.string(),
		content: z.string()
	})
})

const ConversationMessageEnded = z.object({
	event: z.literal("conversation.message.ended"),
	data: z.object({
		totalTokens: z.number()
	})
})

const ConversationEnded = z.object({
	event: z.literal("conversation.ended"),
	data: z.object({
		conversationId: z.string()
	})
})

const ErrorEvent = z.object({
	event: z.literal("error"),
	data: z.object({
		message: z.string()
	})
})

const ConversationVectorStoreCreated = z.object({
	event: z.literal("conversation.vectorstore.created"),
	data: z.object({
		vectorStoreId: z.string()
	})
})

const VendorFileProcessed = z.object({
	event: z.literal("vendor.vectorstore.file.processed"),
	data: z.object({
		fileId: z.string(),
		fileName: z.string()
	})
})

const ConversationFileUploaded = z.object({
	event: z.literal("conversation.vectorstore.file.uploaded"),
	data: z.object({
		fileId: z.string(),
		fileName: z.string()
	})
})

const ConversationFilesProcessed = z.object({
	event: z.literal("conversation.vectorstore.files.processed"),
	data: z.object({
		files: z.array(z.object({ fileId: z.string() })),
		vectorStoreId: z.string()
	})
})

export const MuginSse = z.discriminatedUnion("event", [
	// New events
	ResponseStarted,
	ResponseDone,
	ResponseError,
	ResponseOutputTextDelta,
	ConversationCreated,
	UnknownEvent,
	// Old events
	ConversationStarted,
	ConversationMessageDelta,
	ConversationMessageEnded,
	ConversationEnded,
	ErrorEvent,
	ConversationVectorStoreCreated,
	ConversationFileUploaded,
	ConversationFilesProcessed,
	VendorFileProcessed
])

export type MuginSse = z.infer<typeof MuginSse>
