import { logger } from "@vestfoldfylke/loglady"
import type { SharePointFolderEntry } from "$lib/types/mcp-source"
import type { McpClient } from "./mcp-client"
import type { McpToolDefinition } from "./mcp-tools"
import { parseToolResultItems } from "./parse-tool-result-items"

// Verified live against the real SharePoint MCP server (2026-09-10, via Insomnia + a captured
// tools/list response, see tmp/tools.json) - the integration handover doc turned out to be wrong
// on several counts: parameter names (`folder_path`/`file_url` don't exist - see FOLDER_ARG_KEYS
// below), the tool count (9 real tools, not 7 - `List_SharePoint_Lists`/`Get_SharePoint_List_Items`
// are a whole separate "SharePoint Lists" feature the doc never mentions), and even a parameter the
// doc invented outright (`Get_SharePoint_Tree` takes only `parent_folder` - there is no `max_depth`).
// Given the doc has been wrong repeatedly, this uses an ALLOW-list of specifically reviewed tool
// names rather than a block-list of known-bad ones - any unexpected/undocumented tool is excluded
// by default, not passed through unexamined just because it isn't one of the ones we happened to
// already know to reject.
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
// SharePoint "Lists" (tabular/columned data - a wholly separate content type from document
// libraries, confirmed by tools/list's own descriptions) get their own, differently-shaped
// scoping - see LIST_ITEMS_TOOL_NAME below:
//   List_SharePoint_Lists()                        - inputSchema has NO properties at all (verified
//                                                     in tmp/tools.json), i.e. site-wide, unscopable
//                                                     discovery - there is no argument to restrict it
//                                                     by, so unlike the folder tools it can't be
//                                                     validated per-call. Exposing it to the model
//                                                     would leak the names of every list on the site,
//                                                     not just the ones an admin scoped a source to -
//                                                     so it is NEVER exposed to the model, full stop,
//                                                     the same way Download_Document never is. It's
//                                                     only ever called server-side, by the admin-only
//                                                     browse route backing the source form's list
//                                                     picker (api/mcp-sources/sharepoint/lists) - an
//                                                     admin configuring a source already has to see
//                                                     the full list of names to choose from, same
//                                                     trust level as the folder browser.
//   Get_SharePoint_List_Items(list_name, filter_column?, filter_value?, top?) - list_name is
//                                                     required and matched case-insensitively
//                                                     against the list's display name (verified in
//                                                     tmp/tools.json's description text). This one
//                                                     IS exposed to the model, scoped by list_name
//                                                     against the source's configured `lists`.
const FOLDER_SCOPED_TOOL_NAMES = new Set(["List_SharePoint_Folders", "Get_SharePoint_Tree", "List_SharePoint_Documents", "Get_Document_Content", "Get_File_Metadata"])

const FOLDER_ARG_KEYS = ["parent_folder", "folder_name"]

// Search_SharePoint gained an optional folder_path parameter on 2026-09-12 (server-side change we
// requested - see docs handover) - a plain relative path, same format/semantics as the other
// folder tools' arguments, restricting the search index itself to that path and everything under
// it. Confirmed live: a query with folder_path set omits hits that a call without it returns for
// content outside that path. Before this, Search_SharePoint could not be scoped at all, which is
// why it defaults to disabled - see callScopedSearch below for how it's now enforced.
const SEARCH_TOOL_NAME = "Search_SharePoint"

const LIST_ITEMS_TOOL_NAME = "Get_SharePoint_List_Items"

// Download_Document was verified to save the file to the MCP *server's own* local disk (e.g.
// `/tmp/...`) and never returns the file's actual content in the tool result - there is nothing a
// text-based chat loop can usefully do with "a file was saved somewhere you can't reach". It's
// excluded the same way any other unreviewed tool is: it's simply not in FOLDER_SCOPED_TOOL_NAMES,
// SEARCH_TOOL_NAME or LIST_ITEMS_TOOL_NAME, so isToolAllowed below rejects it by default.
// Exported for unit testing.
export const isToolAllowed = (toolName: string, searchEnabled: boolean, listsEnabled: boolean): boolean => {
	if (FOLDER_SCOPED_TOOL_NAMES.has(toolName)) return true
	if (toolName === SEARCH_TOOL_NAME) return searchEnabled
	if (toolName === LIST_ITEMS_TOOL_NAME) return listsEnabled
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

// Case-insensitive exact match, per Get_SharePoint_List_Items' own documented matching behaviour
// (see tmp/tools.json) - unlike folders, there's no prefix/hierarchy concept for list names.
export const isListNameAllowed = (requestedName: string, lists: string[]): boolean => {
	const normalizedRequested = requestedName.trim().toLowerCase()
	return lists.some((name) => name.trim().toLowerCase() === normalizedRequested)
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

export const extractListNameArg = (args: Record<string, unknown>): string | undefined => {
	const value = args.list_name
	return typeof value === "string" ? value : undefined
}

export const describeFolders = (folders: SharePointFolderEntry[]): string => {
	if (folders.length === 0) {
		return "(ingen mapper)"
	}
	return folders.map((entry) => (entry.matchType === "exact" ? entry.value || "(rot)" : `Alt under ${entry.value || "hele SharePoint-området"}`)).join(", ")
}

export const describeLists = (lists: string[]): string => {
	if (lists.length === 0) {
		return "(ingen lister)"
	}
	return lists.join(", ")
}

// Search_SharePoint's folder_path is inherently recursive - it restricts to a path AND everything
// under it, the same as our own "prefix" matchType. A "prefix" entry maps onto it exactly; an
// "exact" entry (this folder only, explicitly NOT its subfolders, as enforced for every other
// tool) has no equivalent in a recursive-only search - passing its value as folder_path would
// search that folder's subtree too, which is MORE than "exact" is supposed to grant. Known,
// deliberate v1 limitation: an "exact" entry is simply excluded from the search fan-out below (its
// content stays reachable through the regular folder/document tools, just not full-text search) -
// documented here rather than silently either over- or under-scoping.
const searchableFolders = (folders: SharePointFolderEntry[]): SharePointFolderEntry[] => folders.filter((entry) => entry.matchType === "prefix")

// The real tool's own default value for an omitted folder_path is `null` (verified live), not
// simply "absent" - both must be treated as "no scope requested", same as an empty string a model
// might plausibly send instead. None of these are a legitimate request to search unscoped once
// this source has folders configured; scoped-search below is what runs instead.
const hasUsableFolderPathArg = (args: Record<string, unknown>): args is Record<string, unknown> & { folder_path: string } => {
	const value = args.folder_path
	return typeof value === "string" && value.length > 0
}

const callScopedSearch = async (baseClient: McpClient, args: Record<string, unknown>, folders: SharePointFolderEntry[]): Promise<string> => {
	if (folders.length === 0) {
		// No folder restriction configured on this source at all - a deliberate, valid "whole-site
		// search source" (see McpSourceInputSchema's refine - a source may have searchEnabled with
		// zero folders/lists). Unrestricted, exactly as before this change existed.
		return baseClient.callTool(SEARCH_TOOL_NAME, args)
	}

	if (hasUsableFolderPathArg(args)) {
		// The model asked to narrow to a specific path itself (e.g. after already listing folders) -
		// honor it as a single call if it's actually within scope, same validation the other
		// folder-scoped tools already apply below. Reject rather than silently widen/ignore if not.
		if (!isFolderPathAllowed(args.folder_path, folders)) {
			throw new Error(
				`«${args.folder_path}» er ikke en tillatt mappe for denne datakilden. Tillatte mapper: ${describeFolders(folders)}. Ikke gjett filnavn eller mappenavn - bruk List_SharePoint_Folders/List_SharePoint_Documents på en av disse mappene for å se hva som faktisk finnes, før du henter innhold.`
			)
		}
		return baseClient.callTool(SEARCH_TOOL_NAME, args)
	}

	// No usable folder_path from the model - query once per searchable configured folder (in
	// parallel; these are independent calls with no ordering dependency) and merge the results,
	// rather than letting the tool's own "no folder_path" default (whole site) through unrestricted.
	const scopes = searchableFolders(folders)
	if (scopes.length === 0) {
		// Every configured folder is "exact" (not searchable via full-text search - see the module
		// comment above) - there is nothing this call can safely search within scope.
		throw new Error(
			"Fritekst-søk kan ikke begrenses til en enkelt mappe uten undermapper, og denne datakilden har ingen mapper konfigurert med bredere tilgang. Bruk List_SharePoint_Documents/Get_Document_Content på de konfigurerte mappene i stedet."
		)
	}

	const resultsPerFolder = await Promise.all(scopes.map((entry) => baseClient.callTool(SEARCH_TOOL_NAME, { ...args, folder_path: entry.value })))
	const mergedItems = resultsPerFolder.flatMap((text) => parseToolResultItems(text))
	const rowLimit = args.row_limit
	const limitedItems = typeof rowLimit === "number" && rowLimit >= 0 ? mergedItems.slice(0, rowLimit) : mergedItems
	return JSON.stringify({ result: limitedItems })
}

export const createScopedSharePointClient = (baseClient: McpClient, folders: SharePointFolderEntry[], searchEnabled: boolean, lists: string[]): McpClient => {
	return {
		async listTools(): Promise<McpToolDefinition[]> {
			const tools = await baseClient.listTools()
			const listsEnabled = lists.length > 0
			const allowed = tools.filter((tool) => isToolAllowed(tool.name, searchEnabled, listsEnabled))
			const rejected = tools.filter((tool) => !isToolAllowed(tool.name, searchEnabled, listsEnabled)).map((tool) => tool.name)
			if (rejected.length > 0) {
				logger.info("[scoped-sharepoint] Tools not exposed to the model (unreviewed or disabled): {names}", rejected.join(", "))
			}
			return allowed.map((tool) => {
				if (tool.name === SEARCH_TOOL_NAME) return tool
				if (tool.name === LIST_ITEMS_TOOL_NAME) return { ...tool, description: `${tool.description}\n\nDenne boten har kun tilgang til disse listene: ${describeLists(lists)}` }
				return { ...tool, description: `${tool.description}\n\nDenne boten har kun tilgang til: ${describeFolders(folders)}` }
			})
		},
		async callTool(name: string, args: Record<string, unknown>): Promise<string> {
			const listsEnabled = lists.length > 0
			if (!isToolAllowed(name, searchEnabled, listsEnabled)) {
				throw new Error(`Verktøyet ${name} er ikke tilgjengelig for denne datakilden`)
			}
			if (name === SEARCH_TOOL_NAME) {
				return callScopedSearch(baseClient, args, folders)
			}
			if (name === LIST_ITEMS_TOOL_NAME) {
				const listNameArg = extractListNameArg(args)
				if (listNameArg === undefined) {
					logger.warn("[scoped-sharepoint] Tool call {name} had no recognized list_name argument", name)
					throw new Error(`Verktøyet ${name} manglet et forventet list_name-argument`)
				}
				if (!isListNameAllowed(listNameArg, lists)) {
					throw new Error(`«${listNameArg}» er ikke en tillatt liste for denne datakilden. Tillatte lister: ${describeLists(lists)}. Ikke gjett listenavn - bruk et av navnene over.`)
				}
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
