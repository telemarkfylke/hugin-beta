import z from "zod"
import { SupportedVendorIds } from "./vendor-ids"

export const VectorStore = z.object({
	id: z.string(),
	vendorId: SupportedVendorIds,
	name: z.string(),
	description: z.string(),
	generatedDescription: z.string().nullable(),
	numberOfFiles: z.number(),
	totalBytes: z.number(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime().nullable()
})

export type VectorStore = z.infer<typeof VectorStore>

const vectorStoreFileStatusEnum = z.enum(["ready", "processing", "error"])

export type VectorStoreFileStatus = z.infer<typeof vectorStoreFileStatusEnum>

export const VectorStoreFile = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	bytes: z.number(),
	summary: z.string().nullable().optional(),
	status: vectorStoreFileStatusEnum
})

export type VectorStoreFile = z.infer<typeof VectorStoreFile>
