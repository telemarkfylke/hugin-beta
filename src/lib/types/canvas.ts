import z from "zod"

const MAX_DOCUMENT_CHARS = 10 * 1024 * 1024 // 10 MB

export const CanvasRequestSchema = z.object({
	document: z.string().max(MAX_DOCUMENT_CHARS, "Document is too large"),
	prompt: z.string().min(1, "prompt must be a non-empty string"),
	webSearch: z.boolean().optional()
})

export type CanvasRequest = z.infer<typeof CanvasRequestSchema>
