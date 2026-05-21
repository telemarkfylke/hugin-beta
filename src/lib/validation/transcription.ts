import z from "zod"

export const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

export const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

export const DeleteJobSchema = z.object({
	id: z.string().min(1),
	fileName: z.string().min(1),
	audioUrl: z.string().url().nullable().optional(),
	docxUrl: z.string().url().nullable().optional()
})
