import { parseToolResultItems } from "./parse-tool-result-items"

// Best-effort parsing of List_SharePoint_Lists' result shape - backs the admin-only SharePoint
// list picker (see api/mcp-sources/sharepoint/lists/+server.ts and McpListBrowser.svelte).
// List_SharePoint_Lists declares an outputSchema of `{result: [{...arbitrary fields...}]}` in
// tools/list (see tmp/tools.json), but the exact field holding a list's display name was never
// captured live - only the input schema (no arguments) and the fact that Get_SharePoint_List_Items
// matches `list_name` case-insensitively against that display name. Tries the field names SharePoint's
// own APIs conventionally use for a list's title, in order, plus a bare string item (in case the
// tool ever returns plain names rather than objects) - never guesses a name from something that
// isn't clearly one, unlike parseFolderList which can fall back to `path` when `name` is missing.
export const parseListNames = (text: string): string[] => {
	const rawItems = parseToolResultItems(text)

	const names = rawItems
		.map((item): string | null => {
			if (typeof item === "string") {
				return item
			}
			if (item && typeof item === "object") {
				const obj = item as Record<string, unknown>
				const candidate = obj.title ?? obj.Title ?? obj.name ?? obj.Name ?? obj.displayName ?? obj.DisplayName
				return typeof candidate === "string" ? candidate : null
			}
			return null
		})
		.filter((name): name is string => name !== null)

	// Dedupe while preserving order - harmless if the server never actually returns duplicates, but
	// cheap insurance against a picker showing the same list twice.
	return Array.from(new Set(names))
}
