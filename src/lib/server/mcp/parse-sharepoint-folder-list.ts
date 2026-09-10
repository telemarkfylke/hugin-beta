export type SharePointBrowseFolder = { name: string; path: string }

const tryParseJson = (text: string): unknown | undefined => {
	try {
		return JSON.parse(text)
	} catch {
		return undefined
	}
}

// Splits text that might contain several back-to-back JSON object literals with no separator
// between them (e.g. `{...}{...}`) into their individual substrings, by tracking brace depth and
// string/escape state. Only used as a fallback when the whole text isn't valid JSON on its own -
// see parseFolderList's module comment on why this defensiveness exists at all.
const splitConcatenatedJsonObjects = (text: string): string[] => {
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
// content[].text - `{ "name": "Kapish", "url": "https://.../Ruens%20hjørne/Trudelutt/Kapish", ... }`
// - not an array, and not wrapped under any "result"/"folders"/"items" key (unlike
// List_SharePoint_Documents/Get_File_Metadata, which do carry a "result" array in
// structuredContent - but McpClient.callTool only ever returns the flattened content[].text, see
// mcp-client.ts's flattenToolResult). The multi-match shape is NOT verified - this defends against
// both plausible shapes: a proper JSON array, or multiple bare objects with no separator between
// them (which splitConcatenatedJsonObjects above unpacks). Re-verify once a folder with 2+
// children has actually been browsed through this route.
const extractItems = (parsed: unknown): unknown[] => {
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

// Best-effort parsing of List_SharePoint_Folders' result shape - backs the admin-only SharePoint
// folder browser (see api/mcp-sources/sharepoint/browse/+server.ts and McpFolderBrowser.svelte).
export const parseFolderList = (text: string, parentFolder: string): SharePointBrowseFolder[] => {
	const whole = tryParseJson(text)
	const rawItems =
		whole !== undefined
			? extractItems(whole)
			: splitConcatenatedJsonObjects(text)
					.map(tryParseJson)
					.filter((value): value is object => value !== undefined)

	return rawItems
		.map((item): SharePointBrowseFolder | null => {
			if (typeof item === "string") {
				return { name: item, path: parentFolder ? `${parentFolder}/${item}` : item }
			}
			if (item && typeof item === "object") {
				const obj = item as Record<string, unknown>
				const name = typeof obj.name === "string" ? obj.name : typeof obj.folder_name === "string" ? obj.folder_name : null
				if (!name) return null
				const path = typeof obj.path === "string" ? obj.path : parentFolder ? `${parentFolder}/${name}` : name
				return { name, path }
			}
			return null
		})
		.filter((folder): folder is SharePointBrowseFolder => folder !== null)
}
