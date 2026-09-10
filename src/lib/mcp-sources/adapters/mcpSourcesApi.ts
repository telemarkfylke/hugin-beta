import type { McpSource, McpSourceInput } from "$lib/types/mcp-source"

const BASE = "/api/mcp-sources"

export type SharePointBrowseFolder = { name: string; path: string }
export type SharePointBrowseResult = { parentFolder: string; folders: SharePointBrowseFolder[] }

export class McpSourcesApi {
	async getSources(): Promise<McpSource[]> {
		const res = await fetch(BASE)
		if (!res.ok) return []
		return (await res.json()) as McpSource[]
	}

	async createSource(input: McpSourceInput): Promise<McpSource | null> {
		const res = await fetch(BASE, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input)
		})
		if (!res.ok) return null
		return (await res.json()) as McpSource
	}

	async updateSource(sourceId: string, input: McpSourceInput): Promise<McpSource | null> {
		const res = await fetch(`${BASE}/${sourceId}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input)
		})
		if (!res.ok) return null
		return (await res.json()) as McpSource
	}

	async deleteSource(sourceId: string): Promise<boolean> {
		const res = await fetch(`${BASE}/${sourceId}`, { method: "DELETE" })
		return res.ok
	}

	// Admin-only SharePoint folder browsing, backing McpFolderBrowser.svelte - see the browse
	// route's own module comment for why this is gated the same as using MCP at all, not more
	// strictly.
	async browseSharePointFolders(parentFolder: string): Promise<SharePointBrowseResult> {
		const res = await fetch(`${BASE}/sharepoint/browse?parent_folder=${encodeURIComponent(parentFolder)}`)
		if (!res.ok) return { parentFolder, folders: [] }
		return (await res.json()) as SharePointBrowseResult
	}
}
