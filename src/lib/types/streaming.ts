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

const ConversationDocumentsUploaded = z.object({
  event: z.literal("conversation.vectorstore.document.uploaded"),
  data: z.object({
    documentId: z.string(),
    fileName: z.string()
  })
});

const ConversationDocumentsProcessed = z.object({
  event: z.literal("conversation.vectorstore.documents.processed"),
  data: z.object({
    documents: z.array(z.object({ documentId: z.string() })),
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
  ConversationDocumentsUploaded,
  ConversationDocumentsProcessed
]);

export type MuginSse = z.infer<typeof MuginSse>;
