import z from "zod"

// The shape a client may send as chat `inputs` - shared by /api/chat and the anonymous embed. Past
// assistant turns can't be verified (incognito and the embed have no stored history, so the client
// sends it), but what CAN be enforced: only user and assistant turns - no client-injected
// system/developer messages overriding the assistant's instructions - and bounded sizes.
const MAX_TEXT_CHARS = 50_000
// Files/images/text parts in one message - generous for real use, stops a single message from
// carrying an unbounded number of parts
const MAX_CONTENT_PARTS = 20

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

export const ChatInputItemSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("message.input"), role: z.literal("user"), content: z.array(InputContentSchema).min(1).max(MAX_CONTENT_PARTS) }),
	z.object({ id: z.string(), type: z.literal("message.output"), role: z.literal("assistant"), content: z.array(OutputContentSchema).max(MAX_CONTENT_PARTS) })
])

// Shown to the user as-is (PostChatMessage displays a 400's message) - a legitimate user mostly gets
// here with an incognito conversation too long to send in one go
export const INVALID_INPUTS_MESSAGE = "Samtalen er for lang eller meldingen er ugyldig. Start en ny samtale og prøv igjen."

type ParsedChatInputItem = z.infer<typeof ChatInputItemSchema>

const textChars = (item: ParsedChatInputItem): number => item.content.reduce((sum, part) => sum + ("text" in part ? part.text.length : "reason" in part ? part.reason.length : 0), 0)

// A whole `inputs` array: at most maxItems items, and at most maxTotalTextChars of text across all of
// them - the per-part cap alone still let maxItems x 50k characters through, i.e. a context-window-
// filling (and model-bill-filling) request in a single call. Attachments are bounded separately
// (file-input.ts, armed attachments).
export const chatInputsSchema = (maxItems: number, maxTotalTextChars: number) =>
	z
		.array(ChatInputItemSchema)
		.min(1)
		.max(maxItems)
		.refine((items) => items.reduce((sum, item) => sum + textChars(item), 0) <= maxTotalTextChars, { message: `inputs may contain at most ${maxTotalTextChars} characters of text` })
