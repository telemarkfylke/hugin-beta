import z from "zod";

/** @typedef {z.infer<typeof MuginEventTypes>} MuginEventTypes */
export const MuginEventTypes = z.enum(['conversation.started', 'message.delta', 'conversation.ended', 'error', 'conversation.vectorstore.created']);

/** @typedef {z.infer<typeof MuginSse>} MuginSse */
export const MuginSse = z.object({
  event: MuginEventTypes,
  data: z.any() // Kan spesifisere mer her basert på event type etterhvert
});