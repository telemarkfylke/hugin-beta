import z from "zod"
import type { VectorStoreFile } from "$lib/types/vector-store"

export const VectorChunk = z.object({
	text: z.string(),
	vectorMatrix: z.array(z.number()),
	fileId: z.string()
})

export type VectorChunk = z.infer<typeof VectorChunk>

export type VectorContext = {
	contextId: string
	name: string
	files: Record<string, VectorStoreFile>
	createdAt: string
}

export type CreateContextConfig = {
	id?: string
	name?: string
	description?: string
}
