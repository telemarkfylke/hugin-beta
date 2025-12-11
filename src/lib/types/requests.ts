import z from "zod"
import { AgentPrompt } from "./message.js"

export const ConversationRequest = z.object({
	prompt: AgentPrompt,
	stream: z.boolean()
})

export type ConversationRequest = z.infer<typeof ConversationRequest>
