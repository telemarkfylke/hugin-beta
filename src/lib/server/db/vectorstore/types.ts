import type { VectorStoreFile } from "$lib/types/vector-store"
import z from "zod"

export const VectorChunk = z.object({
	text: z.string(),
	vectorMatrix: z.array(z.number()),
	fileId: z.string()
})

export type VectorChunk = z.infer<typeof VectorChunk>

export type VectorContext = {
	contextId: string
	vectors: VectorChunk[]
	files: Record<string, VectorStoreFile>
}
