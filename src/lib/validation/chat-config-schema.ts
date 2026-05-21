import z from "zod"

export const ChatConfigSchema = z.object({
	_id: z.string(),
	name: z.string(),
	description: z.string(),
	vendorId: z.enum(["MISTRAL", "OPENAI", "OLLAMA", "LITELLM"]),
	project: z.string(),
	vendorAgent: z.object({ id: z.string() }).optional(),
	model: z.string().optional(),
	tools: z
		.array(z.object({ type: z.enum(["web_search"]) }))
		.nullable()
		.optional(),
	shared: z.boolean().optional(),
	instructions: z.string().optional(),
	conversationId: z.string().optional(),
	type: z.enum(["published", "private"]),
	accessGroups: z.array(z.union([z.literal("all"), z.literal("employee"), z.literal("edu_employee"), z.literal("student"), z.object({ id: z.string(), displayName: z.string() })])),
	created: z.object({
		at: z.string(),
		by: z.object({
			id: z.string(),
			name: z.string().optional()
		})
	}),
	updated: z.object({
		at: z.string(),
		by: z.object({
			id: z.string(),
			name: z.string().optional()
		})
	})
})
