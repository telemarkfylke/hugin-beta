import { logger } from "@vestfoldfylke/loglady"
import type { SharePointFolderEntry } from "$lib/types/mcp-source"
import type { McpClient } from "./mcp-client"
import type { McpToolDefinition } from "./mcp-tools"

// Verified live against the real SharePoint MCP server (2026-09-10, via Insomnia + a captured
// tools/list response) - the integration handover doc turned out to be wrong on several counts:
// parameter names (`folder_path`/`file_url` don't exist - see FOLDER_ARG_KEYS below), the tool
// count (9 real tools, not 7 - `List_SharePoint_Lists`/`Get_SharePoint_List_Items` are a whole
// separate "SharePoint Lists" feature the doc never mentions), and even a parameter the doc
// invented outright (`Get_SharePoint_Tree` takes only `parent_folder` - there is no `max_depth`).
// Given the doc has been wrong repeatedly, this uses an ALLOW-list of specifically reviewed tool
// names rather than a block-list of known-bad ones - any unexpected/undocumented tool (like the
// two SharePoint Lists ones) is excluded by default, not passed through unexamined just because
// it isn't one of the ones we happened to already know to reject.
//
// The real, verified shape of the allowed folder-scoped tools:
//   List_SharePoint_Folders(parent_folder)
//   Get_SharePoint_Tree(parent_folder)
//   List_SharePoint_Documents(folder_name)
//   Get_Document_Content(folder_name, file_name)
//   Get_File_Metadata(folder_name, file_name)
// All five take a plain, undecoded, "/"-separated relative path - never a URL - so one folder
// allow-list scopes all of them. `file_name` (where present) is not scoped separately: if the
// folder is in scope, every file inside it is readable via Get_Document_Content/Get_File_Metadata -
// there is no meaningful narrower unit to restrict to once the folder itself is allowed.
//
// Not (yet) exposed at all, regardless of scope - neither has any folder-shaped argument to scope,
// so admitting them would need a wholly separate allow-list mechanism (e.g. by list_name) that
// doesn't exist yet:
//   List_SharePoint_Lists()                                    - lists SharePoint Lists (a distinct
//                                                                 content type from document libraries)
//   Get_SharePoint_List_Items(list_name, filter_column?, ...)  - reads items from a named list
const FOLDER_SCOPED_TOOL_NAMES = new Set(["List_SharePoint_Folders", "Get_SharePoint_Tree", "List_SharePoint_Documents", "Get_Document_Content", "Get_File_Metadata"])

const FOLDER_ARG_KEYS = ["parent_folder", "folder_name"]

const SEARCH_TOOL_NAME = "Search_SharePoint"

// Download_Document was verified to save the file to the MCP *server's own* local disk (e.g.
// `/tmp/...`) and never returns the file's actual content in the tool result - there is nothing a
// text-based chat loop can usefully do with "a file was saved somewhere you can't reach". It's
// excluded the same way any other unreviewed tool is: it's simply not in FOLDER_SCOPED_TOOL_NAMES
// or SEARCH_TOOL_NAME, so isToolAllowed below rejects it by default.
// Exported for unit testing.
export const isToolAllowed = (toolName: string, searchEnabled: boolean): boolean => {
	if (FOLDER_SCOPED_TOOL_NAMES.has(toolName)) return true
	if (toolName === SEARCH_TOOL_NAME) return searchEnabled
	return false
}

const normalizePath = (path: string): string => path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")

// Same boundary-safe reasoning as website-tool-client.ts's isUrlAllowed - a prefix "Ruens hjørne"
// must not match a sibling folder like "Ruens hjørne 2", only "Ruens hjørne" itself or something
// nested under it ("Ruens hjørne/Trudelutt"). An empty prefix value means "the whole SharePoint
// area" (no restriction).
export const isFolderPathAllowed = (requestedPath: string, folders: SharePointFolderEntry[]): boolean => {
	const normalizedRequested = normalizePath(requestedPath)
	return folders.some((entry) => {
		const normalizedEntry = normalizePath(entry.value)
		if (entry.matchType === "exact") {
			return normalizedRequested === normalizedEntry
		}
		if (normalizedEntry === "") {
			return true
		}
		return normalizedRequested === normalizedEntry || normalizedRequested.startsWith(`${normalizedEntry}/`)
	})
}

// The doc's claimed parameter name (folder_path) turned out to be wrong twice over (see module
// comment) - rather than hardcode one field name per tool name and risk being wrong a third time,
// this just checks every known folder-argument key and validates whichever one is actually
// present.
export const extractFolderArg = (args: Record<string, unknown>): string | undefined => {
	for (const key of FOLDER_ARG_KEYS) {
		const value = args[key]
		if (typeof value === "string") {
			return value
		}
	}
	return undefined
}

export const describeFolders = (folders: SharePointFolderEntry[]): string => {
	if (folders.length === 0) {
		return "(ingen mapper)"
	}
	return folders.map((entry) => (entry.matchType === "exact" ? entry.value || "(rot)" : `Alt under ${entry.value || "hele SharePoint-området"}`)).join(", ")
}

export const createScopedSharePointClient = (baseClient: McpClient, folders: SharePointFolderEntry[], searchEnabled: boolean): McpClient => {
	return {
		async listTools(): Promise<McpToolDefinition[]> {
			const tools = await baseClient.listTools()
			const allowed = tools.filter((tool) => isToolAllowed(tool.name, searchEnabled))
			const rejected = tools.filter((tool) => !isToolAllowed(tool.name, searchEnabled)).map((tool) => tool.name)
			if (rejected.length > 0) {
				logger.info("[scoped-sharepoint] Tools not exposed to the model (unreviewed or disabled): {names}", rejected.join(", "))
			}
			return allowed.map((tool) => (tool.name === SEARCH_TOOL_NAME ? tool : { ...tool, description: `${tool.description}\n\nDenne boten har kun tilgang til: ${describeFolders(folders)}` }))
		},
		async callTool(name: string, args: Record<string, unknown>): Promise<string> {
			if (!isToolAllowed(name, searchEnabled)) {
				throw new Error(`Verktøyet ${name} er ikke tilgjengelig for denne datakilden`)
			}
			if (name === SEARCH_TOOL_NAME) {
				return baseClient.callTool(name, args)
			}
			const folderArg = extractFolderArg(args)
			if (folderArg === undefined) {
				logger.warn("[scoped-sharepoint] Tool call {name} had no recognized folder argument", name)
				throw new Error(`Verktøyet ${name} manglet et forventet mappe-argument`)
			}
			if (!isFolderPathAllowed(folderArg, folders)) {
				// Names the actual allowed folders in the rejection itself (not just "no"), so the
				// model can self-correct in the same turn instead of guessing again blindly - this is
				// the exact failure mode that motivated this: a model guessed "Profiles/Eldrin.txt"
				// out of a generic prior (a plausible-sounding folder/file name), and only backed off
				// once it happened to List_SharePoint_Documents first, several turns later.
				throw new Error(
					`«${folderArg}» er ikke en tillatt mappe for denne datakilden. Tillatte mapper: ${describeFolders(folders)}. Ikke gjett filnavn eller mappenavn - bruk List_SharePoint_Folders/List_SharePoint_Documents på en av disse mappene for å se hva som faktisk finnes, før du henter innhold.`
				)
			}
			return baseClient.callTool(name, args)
		}
	}
}
