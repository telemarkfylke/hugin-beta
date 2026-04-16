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
	docx_url: z.url().nullable().optional()
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
export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>

export type TranscriptionJobStatus = "uploading" | "processing" | "completed" | "failed"

export type TranscriptionJob = {
	id: string
	userId: string
	fileName: string
	audioUrl?: string
	status: TranscriptionJobStatus
	createdAt: string
	updatedAt: string
	jobId?: string
	durationSeconds?: number | null
	error?: string | null
	result?: TranscriptionResult | null
}
