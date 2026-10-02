import z from "zod"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatConfig } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import { validateFileInputs } from "./file-input"

// The anonymous embed has no stored history, so the visitor's client must send the whole conversation
// - past assistant turns included, which can't be verified. What CAN be enforced: only user and
// assistant turns (no client-injected system/developer messages overriding the bot's instructions),
// a bounded size, and the same file rules as /api/chat.
const MAX_INPUT_ITEMS = 100
const MAX_TEXT_CHARS = 50_000

const InputContentSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("input_text"), text: z.string().max(MAX_TEXT_CHARS) }),
	z.object({ type: z.literal("input_file"), fileName: z.string().max(255), fileUrl: z.string() }),
	z.object({ type: z.literal("input_image"), imageUrl: z.string() })
])

const UrlCitationSchema = z.object({
	type: z.literal("url_citation"),
	url: z.string(),
	title: z.string(),
	startIndex: z.number().optional(),
	endIndex: z.number().optional()
})

const OutputContentSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("output_text"), text: z.string().max(MAX_TEXT_CHARS), annotations: z.array(UrlCitationSchema).optional() }),
	z.object({ type: z.literal("output_refusal"), reason: z.string().max(MAX_TEXT_CHARS) })
])

const EmbedInputItemSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("message.input"), role: z.literal("user"), content: z.array(InputContentSchema).min(1) }),
	z.object({ id: z.string(), type: z.literal("message.output"), role: z.literal("assistant"), content: z.array(OutputContentSchema) })
])

const EmbedInputsSchema = z.array(EmbedInputItemSchema).min(1).max(MAX_INPUT_ITEMS)

export const parseEmbedInputs = (rawInputs: unknown, dbConfig: ChatConfig, appConfig: AppConfig): ChatInputItem[] => {
	const parsed = EmbedInputsSchema.safeParse(rawInputs)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid inputs")
	}
	const inputs = parsed.data as ChatInputItem[]

	const hasFiles = inputs.some((item) => item.type === "message.input" && item.content.some((content) => content.type !== "input_text"))
	if (hasFiles && dbConfig.showAttachmentButton === false) {
		throw new HTTPError(400, "Attachments are not allowed for this assistant")
	}

	// Checks the last message's file against the bot's model and drops unsupported files from earlier turns
	validateFileInputs({ config: dbConfig, inputs }, appConfig)
	return inputs
}
