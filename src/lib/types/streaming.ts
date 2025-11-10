import z from "zod";

export const MuginEventTypes = z.enum(['conversation.started', 'message.delta', 'conversation.ended', 'error', 'conversation.vectorstore.created']);

export type MuginEventTypes = z.infer<typeof MuginEventTypes>;

export const MuginSse = z.object({
  event: MuginEventTypes,
  data: z.any() // Kan spesifisere mer her basert på event type etterhvert
});

export type MuginSse = z.infer<typeof MuginSse>;