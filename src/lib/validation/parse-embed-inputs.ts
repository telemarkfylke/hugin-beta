import z from "zod"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatConfig } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import { ChatInputItemSchema } from "./chat-input-schema"
import { validateFileInputs } from "./file-input"

// The anonymous embed has no stored history, so the visitor's client must send the whole conversation.
// Item shape/roles/sizes: see chat-input-schema.ts. Plus the same file rules as /api/chat.
const MAX_INPUT_ITEMS = 100

const EmbedInputsSchema = z.array(ChatInputItemSchema).min(1).max(MAX_INPUT_ITEMS)

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
