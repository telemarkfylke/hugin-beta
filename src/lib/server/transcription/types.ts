import z from "zod"

export const TranscriptionSegmentSchema = z.object({
	start: z.number(),
	end: z.number(),
	text: z.string(),
	speaker: z.string().nullable().optional()
})

export const TranscriptionResultSchema = z.object({
	text: z.string(),
	segments: z.array(TranscriptionSegmentSchema).optional().default([]),
	paragraphs: z.array(z.string()).optional().default([]),
	language: z.string().optional(),
	// Still sent by tale-til-notat, but ignored: Hugin builds and stores the Word document itself (in S3)
	docx_url: z.string().nullable().optional()
})

export const TranscriptionCallbackSchema = z.object({
	job_id: z.string(),
	status: z.enum(["completed", "failed"]),
	user_email: z.string().nullable().optional(),
	upn: z.string(),
	completed_at: z.string(),
	duration_seconds: z.number().nullable().optional(),
	error: z.string().nullable().optional(),
	result: TranscriptionResultSchema.nullable().optional()
})

export type TranscriptionCallback = z.infer<typeof TranscriptionCallbackSchema>
export type TranscriptionResult = Omit<z.infer<typeof TranscriptionResultSchema>, "docx_url">

export type TranscriptionJobStatus = "uploading" | "processing" | "completed" | "failed"

export type TranscriptionJob = {
	id: string
	userId: string
	fileName: string
	status: TranscriptionJobStatus
	createdAt: string
	updatedAt: string
	jobId?: string
	durationSeconds?: number | null
	error?: string | null
	result?: TranscriptionResult | null
	// True once Hugin has stored the Word document in S3
	hasDocx?: boolean
}
