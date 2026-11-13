// OpenAI models sometimes leak ChatGPT-internal citation markers into output_text, e.g.
// "fileciteturn0file6turn0file7". U+E200 opens a marker, U+E202 separates
// fields and U+E201 closes it. They reference nothing we can resolve, and render as tofu boxes.
// An unterminated marker (still streaming) is removed up to the end of the text.
const CITATION_MARKER = /[^]*(?:|$)/g
const STRAY_MARKER_CHARS = /[-]/g

export const stripCitationMarkers = (text: string): string => {
	if (!/[-]/.test(text)) return text
	return text.replace(CITATION_MARKER, "").replace(STRAY_MARKER_CHARS, "")
}
