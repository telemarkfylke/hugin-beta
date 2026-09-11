import { parseToolResultItems } from "./parse-tool-result-items"

export type SharePointBrowseFolder = { name: string; path: string }

// Best-effort parsing of List_SharePoint_Folders' result shape - backs the admin-only SharePoint
// folder browser (see api/mcp-sources/sharepoint/browse/+server.ts and McpFolderBrowser.svelte).
// Verified live (2026-09-10): a folder with exactly one match returns a single BARE object in
// content[].text - `{ "name": "Kapish", "url": "https://.../Ruens%20hjørne/Trudelutt/Kapish", ... }`
// - not an array, and not wrapped under any "result"/"folders"/"items" key, and List_SharePoint_Folders
// declares no outputSchema at all in tools/list (unlike List_SharePoint_Documents/Search_SharePoint/
// List_SharePoint_Lists, which do declare `{result: [...]}` - see tmp/tools.json). The multi-match
// shape is NOT verified - parseToolResultItems (see parse-tool-result-items.ts) defends against
// both plausible shapes anyway. Re-verify once a folder with 2+ children has actually been browsed
// through this route.
export const parseFolderList = (text: string, parentFolder: string): SharePointBrowseFolder[] => {
	const rawItems = parseToolResultItems(text)

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
