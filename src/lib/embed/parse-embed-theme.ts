export type EmbedTheme = "light" | "dark" | "auto"

export type EmbedThemeParams = {
	theme: EmbedTheme
	accent: string | undefined
	title: string | undefined
	compact: boolean
}

// Strict on purpose - this value is later interpolated into a style="" attribute (see
// EmbedChat.svelte's accentStyle), so anything other than exactly 6 hex digits must be dropped here.
export const ACCENT_HEX_PATTERN = /^[0-9a-fA-F]{6}$/

const VALID_THEMES: ReadonlySet<string> = new Set(["light", "dark", "auto"])
const MAX_TITLE_LENGTH = 100

// Pure, boundary-validation function for the embed page's optional theming query params (?theme=,
// ?accent=, ?title=, ?compact=). Unknown params are ignored; invalid values fall back to the
// documented default rather than throwing, since a malformed query param on a public embed URL
// should degrade gracefully, not break the widget.
export const parseEmbedThemeParams = (searchParams: URLSearchParams): EmbedThemeParams => {
	const rawTheme = searchParams.get("theme")
	const theme = (rawTheme && VALID_THEMES.has(rawTheme) ? rawTheme : "auto") as EmbedTheme

	const rawAccent = searchParams.get("accent")
	const accent = rawAccent && ACCENT_HEX_PATTERN.test(rawAccent) ? rawAccent.toLowerCase() : undefined

	const rawTitle = searchParams.get("title")?.trim()
	const title = rawTitle ? rawTitle.slice(0, MAX_TITLE_LENGTH) : undefined

	const compact = searchParams.get("compact") === "1"

	return { theme, accent, title, compact }
}
