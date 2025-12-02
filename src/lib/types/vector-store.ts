import z from "zod"

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
