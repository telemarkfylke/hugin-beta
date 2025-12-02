import z from "zod"
import { Message } from "./message.js"

export const Conversation = z.object({
	_id: z.string(),
	agentId: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	relatedConversationId: z.string(), // id fra leverandør (Mistral/OpenAI)
	vectorStoreId: z.string().nullable(), // id for vector store knyttet til denne samtalen (for filer bruker laster opp i en conversation)
	messages: z.array(Message) // Om leverandør ikke støtter hent meldingene direkte, kaaan de legges her inntil videre
})

export type Conversation = z.infer<typeof Conversation>
