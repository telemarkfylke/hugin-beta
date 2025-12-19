import z from "zod"

export const VectorChunk = z.object({
	text: z.string(),
	vectorMatrix: z.array(z.number())
})

export type VectorChunk = z.infer<typeof VectorChunk>
