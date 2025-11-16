import z from "zod";

const ConversationStarted = z.object({
  event: z.literal("conversation.started"),
  data: z.object({
    conversationId: z.string()
  })
});

const ConversationMessageDelta = z.object({
  event: z.literal("conversation.message.delta"),
  data: z.object({
    messageId: z.string(),
    content: z.string()
  })
});

const ConversationMessageEnded = z.object({
  event: z.literal("conversation.message.ended"),
  data: z.object({
    totalTokens: z.number()
  })
});

const ConversationEnded = z.object({
  event: z.literal("conversation.ended"),
  data: z.object({
    conversationId: z.string()
  })
});

const ErrorEvent = z.object({
  event: z.literal("error"),
  data: z.object({
    message: z.string()
  })
});

const ConversationVectorStoreCreated = z.object({
  event: z.literal("conversation.vectorstore.created"),
  data: z.object({
    vectorStoreId: z.string()
  })
});

const ConversationFileUploaded = z.object({
  event: z.literal("conversation.vectorstore.file.uploaded"),
  data: z.object({
    fileId: z.string(),
    fileName: z.string()
  })
});

const ConversationFilesProcessed = z.object({
  event: z.literal("conversation.vectorstore.files.processed"),
  data: z.object({
    files: z.array(z.object({ fileId: z.string() })),
    vectorStoreId: z.string()
  })
});

export const MuginSse = z.discriminatedUnion("event", [
  ConversationStarted,
  ConversationMessageDelta,
  ConversationMessageEnded,
  ConversationEnded,
  ErrorEvent,
  ConversationVectorStoreCreated,
  ConversationFileUploaded,
  ConversationFilesProcessed
]);

export type MuginSse = z.infer<typeof MuginSse>;
