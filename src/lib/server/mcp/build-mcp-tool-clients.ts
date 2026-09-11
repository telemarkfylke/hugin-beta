import type { McpSource } from "$lib/types/mcp-source"
import type { McpClient } from "./mcp-client"
import { getSharepointMcpClient } from "./mcp-client"
import { createScopedSharePointClient } from "./scoped-sharepoint-client"

export type BuildMcpToolClientsResult = {
	clients: McpClient[]
	// True if at least one selected source needed a server connection that turned out to be
	// unavailable - the caller should treat this as a hard failure (mcpUnavailableStream), not
	// silently proceed as if that source's tools simply don't exist.
	unavailable: boolean
}

// Groups the bot's selected McpSources by `server` and builds one scoped client per group -
// today there's only ever one group ("sharepoint"), sharing the one real SharePoint MCP
// connection (getSharepointMcpClient() is already a singleton) but scoped to the UNION of every
// selected SharePoint source's folders/searchEnabled/lists. A future second server just adds another
// `if` branch here - see mcp-source.ts's module comment.
export const buildMcpToolClients = async (sources: McpSource[]): Promise<BuildMcpToolClientsResult> => {
	const clients: McpClient[] = []
	let unavailable = false

	const sharepointSources = sources.filter((source): source is Extract<McpSource, { server: "sharepoint" }> => source.server === "sharepoint")
	if (sharepointSources.length > 0) {
		const baseClient = await getSharepointMcpClient()
		if (!baseClient) {
			unavailable = true
		} else {
			const folders = sharepointSources.flatMap((source) => source.folders)
			const searchEnabled = sharepointSources.some((source) => source.searchEnabled)
			const lists = Array.from(new Set(sharepointSources.flatMap((source) => source.lists)))
			clients.push(createScopedSharePointClient(baseClient, folders, searchEnabled, lists))
		}
	}

	return { clients, unavailable }
}
