// Shared, defensive JSON-parsing helpers for SharePoint MCP tool results that are documented (or
// verified live) to return a list of items, but whose exact wrapping shape varies by tool and
// isn't fully pinned down for every case - see parse-sharepoint-folder-list.ts's module comment
// for the concrete folder-tool evidence this was first built against. Factored out here so
// parse-sharepoint-folder-list.ts and parse-sharepoint-list-names.ts don't each reimplement the
// same "single bare object vs array vs {result/folders/items: [...]} wrapper" guesswork.

export const tryParseJson = (text: string): unknown | undefined => {
	try {
		return JSON.parse(text)
	} catch {
		return undefined
	}
}

// Splits text that might contain several back-to-back JSON object literals with no separator
// between them (e.g. `{...}{...}`) into their individual substrings, by tracking brace depth and
// string/escape state. Only used as a fallback when the whole text isn't valid JSON on its own.
export const splitConcatenatedJsonObjects = (text: string): string[] => {
	const chunks: string[] = []
	let depth = 0
	let start = -1
	let inString = false
	let escaped = false
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (inString) {
			if (escaped) escaped = false
			else if (char === "\\") escaped = true
			else if (char === '"') inString = false
			continue
		}
		if (char === '"') {
			inString = true
			continue
		}
		if (char === "{") {
			if (depth === 0) start = i
			depth++
		} else if (char === "}") {
			depth--
			if (depth === 0 && start !== -1) {
				chunks.push(text.slice(start, i + 1))
				start = -1
			}
		}
	}
	return chunks
}

// Verified live (2026-09-10): a folder with exactly one match returns a single BARE object in
// content[].text, not an array and not wrapped under any "result"/"folders"/"items" key (unlike
// List_SharePoint_Documents/Search_SharePoint/List_SharePoint_Lists, which all DO declare a
// `{result: [...]}` outputSchema in the real tools/list response - see tmp/tools.json). Handles
// both shapes rather than assuming one, since the wrapping isn't consistent across tools.
export const extractItems = (parsed: unknown): unknown[] => {
	if (Array.isArray(parsed)) return parsed
	if (parsed && typeof parsed === "object") {
		const candidate = parsed as { result?: unknown; folders?: unknown; items?: unknown }
		if (Array.isArray(candidate.result)) return candidate.result
		if (Array.isArray(candidate.folders)) return candidate.folders
		if (Array.isArray(candidate.items)) return candidate.items
		return [parsed]
	}
	return []
}

// Parses a tool's flattened content[].text into a list of raw items, defensively handling every
// shape extractItems above knows about, plus the concatenated-bare-objects fallback.
export const parseToolResultItems = (text: string): unknown[] => {
	const whole = tryParseJson(text)
	if (whole !== undefined) {
		return extractItems(whole)
	}
	return splitConcatenatedJsonObjects(text)
		.map(tryParseJson)
		.filter((value): value is object => value !== undefined)
}
