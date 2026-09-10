import z from "zod"

// A "mcp" DataSource (see chat.ts) references one of these by id. Modeled as a discriminated
// union on `server` - SharePoint (Telemark fylke) is the only server today, but almost certainly
// not the last MCP server Hugin will ever connect to, so a future server just adds a new union
// member here rather than requiring a redesign. Each member's scoping fields are necessarily
// server-specific (a different MCP server would expose a different tool set with a different
// scoping concept entirely), which is why they live inside the union member, not as shared fields.

// A folder scope entry - "" + matchType "prefix" means the whole SharePoint area (no restriction).
// matchType "exact" restricts to exactly that one folder (not its subfolders).
export type SharePointFolderEntry = {
	value: string
	matchType: "exact" | "prefix"
}

export type McpSourceConfig = {
	server: "sharepoint" // only option today - see module comment
	// Governs every path-based SharePoint tool we expose (List_SharePoint_Folders,
	// Get_SharePoint_Tree, List_SharePoint_Documents, Get_Document_Content, Get_File_Metadata) -
	// verified live against the real server that all of them key off the same plain folder-path
	// string, so one list covers all of them. See scoped-sharepoint-client.ts.
	folders: SharePointFolderEntry[]
	// Governs Search_SharePoint (org-wide full-text search, no folder scoping possible at all).
	// Default false - whether this should ever be offered is an open question pending the MCP
	// server owner's input, see scoped-sharepoint-client.ts.
	searchEnabled: boolean
}

export type McpSource = McpSourceConfig & {
	_id: string
	name: string
	createdBy: {
		id: string
		name?: string | undefined
	}
	createdAt: string
	updatedAt: string
}

export type NewMcpSource = Omit<McpSource, "_id">

// Client-supplied fields only - name + the server-specific config. createdBy/createdAt/updatedAt
// are always set server-side (see api/mcp-sources), same split as NewWebsiteSource.
export const McpSourceInputSchema = z
	.discriminatedUnion("server", [
		z.object({
			server: z.literal("sharepoint"),
			name: z.string().min(1, "Navn er påkrevd"),
			folders: z.array(
				z.object({
					value: z.string(),
					matchType: z.enum(["exact", "prefix"])
				})
			),
			searchEnabled: z.boolean()
		})
	])
	.refine((input) => input.folders.length > 0 || input.searchEnabled, "Kilden må enten ha minst én mappe eller ha fritekst-søk aktivert - ellers gir den ingen tilgang i det hele tatt")

export type McpSourceInput = z.infer<typeof McpSourceInputSchema>
