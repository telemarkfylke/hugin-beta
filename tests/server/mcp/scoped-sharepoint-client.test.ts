import { describe, expect, it, vi } from "vitest"
import type { McpClient } from "../../../src/lib/server/mcp/mcp-client"
import { createScopedSharePointClient, extractFolderArg, extractListNameArg, isFolderPathAllowed, isListNameAllowed, isToolAllowed } from "../../../src/lib/server/mcp/scoped-sharepoint-client"
import type { SharePointFolderEntry } from "../../../src/lib/types/mcp-source"

describe("isFolderPathAllowed", () => {
	it("allows an exact match", () => {
		const folders: SharePointFolderEntry[] = [{ value: "Ruens hjørne/Trudelutt", matchType: "exact" }]
		expect(isFolderPathAllowed("Ruens hjørne/Trudelutt", folders)).toBe(true)
	})

	it("rejects a different path on an exact entry", () => {
		const folders: SharePointFolderEntry[] = [{ value: "Ruens hjørne/Trudelutt", matchType: "exact" }]
		expect(isFolderPathAllowed("Ruens hjørne/Trudelutt/Underkategori", folders)).toBe(false)
	})

	it("allows a subfolder under a prefix entry", () => {
		const folders: SharePointFolderEntry[] = [{ value: "Ruens hjørne", matchType: "prefix" }]
		expect(isFolderPathAllowed("Ruens hjørne/Trudelutt", folders)).toBe(true)
	})

	it("rejects a sibling folder that merely starts with the same characters as the prefix", () => {
		// The exact bug a naive startsWith(prefix) check would have - "Ruens hjørne 2" starts with
		// the string "Ruens hjørne" but is not under it.
		const folders: SharePointFolderEntry[] = [{ value: "Ruens hjørne", matchType: "prefix" }]
		expect(isFolderPathAllowed("Ruens hjørne 2", folders)).toBe(false)
	})

	it("allows the prefix folder itself, with or without a trailing slash", () => {
		const folders: SharePointFolderEntry[] = [{ value: "Ruens hjørne", matchType: "prefix" }]
		expect(isFolderPathAllowed("Ruens hjørne", folders)).toBe(true)
		expect(isFolderPathAllowed("Ruens hjørne/", folders)).toBe(true)
	})

	it("treats an empty prefix value as whole-area access", () => {
		const folders: SharePointFolderEntry[] = [{ value: "", matchType: "prefix" }]
		expect(isFolderPathAllowed("Hvor som helst/dypt/nede", folders)).toBe(true)
	})

	it("allows a match against any one of several entries", () => {
		const folders: SharePointFolderEntry[] = [
			{ value: "Ruens hjørne/Trudelutt", matchType: "exact" },
			{ value: "Budsjett", matchType: "prefix" }
		]
		expect(isFolderPathAllowed("Budsjett/2026", folders)).toBe(true)
		expect(isFolderPathAllowed("Ruens hjørne/Trudelutt", folders)).toBe(true)
		expect(isFolderPathAllowed("Annet", folders)).toBe(false)
	})
})

describe("isListNameAllowed", () => {
	it("allows an exact match", () => {
		expect(isListNameAllowed("Programmer", ["Programmer"])).toBe(true)
	})

	it("matches case-insensitively, per Get_SharePoint_List_Items' own documented behaviour", () => {
		expect(isListNameAllowed("programmer", ["Programmer"])).toBe(true)
		expect(isListNameAllowed("PROGRAMMER", ["Programmer"])).toBe(true)
	})

	it("rejects a name that isn't in the list, even if similar", () => {
		expect(isListNameAllowed("Program", ["Programmer"])).toBe(false)
	})

	it("allows a match against any one of several configured lists", () => {
		expect(isListNameAllowed("Budsjettposter", ["Programmer", "Budsjettposter"])).toBe(true)
	})
})

describe("extractFolderArg", () => {
	it("finds parent_folder (List_SharePoint_Folders' real argument name)", () => {
		expect(extractFolderArg({ parent_folder: "Budsjett" })).toBe("Budsjett")
	})

	it("finds folder_name (List_SharePoint_Documents/Get_Document_Content/Get_File_Metadata's real argument name)", () => {
		expect(extractFolderArg({ folder_name: "Budsjett", file_name: "rapport.pdf" })).toBe("Budsjett")
	})

	it("returns undefined when neither key is present", () => {
		expect(extractFolderArg({ query: "budsjett" })).toBeUndefined()
	})
})

describe("extractListNameArg", () => {
	it("finds list_name (Get_SharePoint_List_Items' real argument name, verified in tmp/tools.json)", () => {
		expect(extractListNameArg({ list_name: "Programmer" })).toBe("Programmer")
	})

	it("returns undefined when list_name is not present", () => {
		expect(extractListNameArg({ folder_name: "Budsjett" })).toBeUndefined()
	})
})

describe("isToolAllowed", () => {
	it("allows the reviewed folder-scoped tools regardless of searchEnabled/listsEnabled", () => {
		for (const name of ["List_SharePoint_Folders", "Get_SharePoint_Tree", "List_SharePoint_Documents", "Get_Document_Content", "Get_File_Metadata"]) {
			expect(isToolAllowed(name, false, false)).toBe(true)
			expect(isToolAllowed(name, true, true)).toBe(true)
		}
	})

	it("gates Search_SharePoint on searchEnabled", () => {
		expect(isToolAllowed("Search_SharePoint", false, true)).toBe(false)
		expect(isToolAllowed("Search_SharePoint", true, true)).toBe(true)
	})

	it("gates Get_SharePoint_List_Items on listsEnabled", () => {
		expect(isToolAllowed("Get_SharePoint_List_Items", true, false)).toBe(false)
		expect(isToolAllowed("Get_SharePoint_List_Items", true, true)).toBe(true)
	})

	it("rejects Download_Document regardless of searchEnabled/listsEnabled", () => {
		expect(isToolAllowed("Download_Document", true, true)).toBe(false)
	})

	it("rejects List_SharePoint_Lists even when listsEnabled - it takes no scoping argument at all (verified in tmp/tools.json: empty inputSchema), so exposing it to the model would leak every list's name on the site, not just the scoped ones", () => {
		expect(isToolAllowed("List_SharePoint_Lists", true, true)).toBe(false)
	})

	it("rejects any other undocumented/unreviewed tool by default - this is the actual bug it fixes: a live test surfaced real tools (List_SharePoint_Lists at the time) the integration doc never mentioned, which a block-list would have passed straight through unexamined", () => {
		expect(isToolAllowed("Some_New_Tool", true, true)).toBe(false)
	})
})

const makeBaseClient = (overrides?: Partial<McpClient>): McpClient => ({
	listTools: vi.fn().mockResolvedValue([
		{ name: "List_SharePoint_Folders", description: "List sub-folders", inputSchema: {} },
		{ name: "Get_SharePoint_Tree", description: "Recursive tree", inputSchema: {} },
		{ name: "List_SharePoint_Documents", description: "List files", inputSchema: {} },
		{ name: "Search_SharePoint", description: "Full-text KQL search", inputSchema: {} },
		{ name: "Get_Document_Content", description: "Extract text", inputSchema: {} },
		{ name: "Get_File_Metadata", description: "Metadata", inputSchema: {} },
		{ name: "Download_Document", description: "Save to local disk", inputSchema: {} },
		{ name: "List_SharePoint_Lists", description: "Discover list names", inputSchema: {} },
		{ name: "Get_SharePoint_List_Items", description: "Read items from a named list", inputSchema: {} }
	]),
	callTool: vi.fn().mockResolvedValue("ok"),
	...overrides
})

describe("createScopedSharePointClient", () => {
	it("never exposes Download_Document, regardless of scope", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [{ value: "", matchType: "prefix" }], true, [])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Download_Document")).toBe(false)
	})

	it("never exposes List_SharePoint_Lists to the model, even with lists configured", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [], false, ["Programmer"])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "List_SharePoint_Lists")).toBe(false)
	})

	it("never exposes an undocumented tool the base server happens to return", async () => {
		const baseClient = makeBaseClient({
			listTools: vi.fn().mockResolvedValue([{ name: "Some_New_Tool", description: "Not reviewed yet", inputSchema: {} }])
		})
		const client = createScopedSharePointClient(baseClient, [{ value: "", matchType: "prefix" }], true, [])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Some_New_Tool")).toBe(false)
	})

	it("rejects a call to an undocumented tool without forwarding it, even with a folder-shaped argument", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "", matchType: "prefix" }], true, [])
		await expect(client.callTool("List_SharePoint_Lists", { parent_folder: "" })).rejects.toThrow()
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})

	it("hides Search_SharePoint when searchEnabled is false", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [{ value: "", matchType: "prefix" }], false, [])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Search_SharePoint")).toBe(false)
	})

	it("exposes Search_SharePoint when searchEnabled is true", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [{ value: "", matchType: "prefix" }], true, [])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Search_SharePoint")).toBe(true)
	})

	it("hides Get_SharePoint_List_Items when no lists are configured", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [{ value: "", matchType: "prefix" }], false, [])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Get_SharePoint_List_Items")).toBe(false)
	})

	it("exposes Get_SharePoint_List_Items when at least one list is configured", async () => {
		const client = createScopedSharePointClient(makeBaseClient(), [], false, ["Programmer"])
		const tools = await client.listTools()
		expect(tools.some((t) => t.name === "Get_SharePoint_List_Items")).toBe(true)
	})

	it("forwards a folder-scoped call for an in-scope path", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "Budsjett", matchType: "prefix" }], false, [])
		await client.callTool("List_SharePoint_Folders", { parent_folder: "Budsjett/2026" })
		expect(baseClient.callTool).toHaveBeenCalledWith("List_SharePoint_Folders", { parent_folder: "Budsjett/2026" })
	})

	it("rejects a folder-scoped call for an out-of-scope path without forwarding it", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "Budsjett", matchType: "prefix" }], false, [])
		await expect(client.callTool("Get_Document_Content", { folder_name: "Annet", file_name: "x.txt" })).rejects.toThrow()
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})

	it("names the actual allowed folders in the rejection, so the model can self-correct instead of guessing again - the real failure this fixes: a model guessed folder_name 'Profiles' out of a generic prior, with nothing in the error telling it what was actually allowed", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "Ruens hjørne/Tingwell", matchType: "prefix" }], false, [])
		await expect(client.callTool("Get_Document_Content", { folder_name: "Profiles", file_name: "Eldrin.txt" })).rejects.toThrow(/Ruens hjørne\/Tingwell/)
	})

	it("rejects Search_SharePoint when searchEnabled is false, without forwarding it", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "", matchType: "prefix" }], false, [])
		await expect(client.callTool("Search_SharePoint", { query: "budsjett" })).rejects.toThrow()
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})

	it("rejects Download_Document even if somehow called directly, without forwarding it", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [{ value: "", matchType: "prefix" }], false, [])
		await expect(client.callTool("Download_Document", { folder_name: "x", file_name: "y.txt", save_path: "z" })).rejects.toThrow()
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})

	it("rejects Get_SharePoint_List_Items when no lists are configured, without forwarding it", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [], false, [])
		await expect(client.callTool("Get_SharePoint_List_Items", { list_name: "Programmer" })).rejects.toThrow()
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})

	it("forwards a call to Get_SharePoint_List_Items for an in-scope list name, case-insensitively", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [], false, ["Programmer"])
		await client.callTool("Get_SharePoint_List_Items", { list_name: "programmer", top: 10 })
		expect(baseClient.callTool).toHaveBeenCalledWith("Get_SharePoint_List_Items", { list_name: "programmer", top: 10 })
	})

	it("rejects a call to Get_SharePoint_List_Items for an out-of-scope list name, naming the allowed lists in the error", async () => {
		const baseClient = makeBaseClient()
		const client = createScopedSharePointClient(baseClient, [], false, ["Programmer"])
		await expect(client.callTool("Get_SharePoint_List_Items", { list_name: "Budsjettposter" })).rejects.toThrow(/Programmer/)
		expect(baseClient.callTool).not.toHaveBeenCalled()
	})
})
