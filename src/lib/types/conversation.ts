import z from "zod"
import { Message } from "./message.js"
import { SupportedVendorIds } from "./vendor-ids"

export const DBConversation = z.object({
	_id: z.string(),
	agentId: z.string(),
	vendorId: SupportedVendorIds,
	name: z.string(),
	description: z.string().nullable().optional(),
	vendorConversationId: z.string(), // id fra leverandør
	vectorStoreId: z.string().nullable(), // id for vector store knyttet til denne samtalen (for filer bruker laster opp i en conversation)
	messages: z.array(Message) // Om leverandør ikke støtter hent meldingene direkte, kaaan de legges her inntil videre
})

export type DBConversation = z.infer<typeof DBConversation>

export const VendorConversation = z.object({
	id: z.string(),
	vendorId: SupportedVendorIds,
	createdAt: z.iso.datetime(),
	title: z.string().nullable()
})

export type VendorConversation = z.infer<typeof VendorConversation>
