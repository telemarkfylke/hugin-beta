import type { ChatOutputItem } from "$lib/types/chat-item"

const UNSUPPORTED_OUTPUT_PREFIX = "Unsupported output item from OpenAI:"

// gpt-5.6-terra is a reasoning model - OpenAI's Responses API returns a "reasoning" output item
// alongside the real "message" one. The shared mapping (openai-mapping.ts) turns any non-message
// output item into a placeholder output_text with this prefix rather than dropping it, so strip
// it before treating the response as raw text. The document-editor endpoint never hits this path
// since it streams instead of calling createChatResponse.
export const extractTextOutput = (outputs: ChatOutputItem[]): string => {
	return outputs
		.flatMap((output) => output.content)
		.filter((content) => content.type === "output_text")
		.filter((content) => !content.text.startsWith(UNSUPPORTED_OUTPUT_PREFIX))
		.map((content) => content.text)
		.join("")
}
