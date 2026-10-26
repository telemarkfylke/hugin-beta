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
