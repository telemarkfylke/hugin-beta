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
	// Deliberately throws on a non-ok response instead of returning an empty folder list - an
	// empty list here is indistinguishable in the UI from "this folder genuinely has no
	// subfolders", which would silently hide a real problem (e.g. the SharePoint MCP connection
	// not being configured at all on this deployment) as if it were just an empty result.
	async browseSharePointFolders(parentFolder: string): Promise<SharePointBrowseResult> {
		const res = await fetch(`${BASE}/sharepoint/browse?parent_folder=${encodeURIComponent(parentFolder)}`)
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: string } | null
			throw new Error(body?.message ?? `Henting av mapper feilet (HTTP ${res.status})`)
		}
		return (await res.json()) as SharePointBrowseResult
	}

	// Admin-only SharePoint list-name browsing, backing McpListBrowser.svelte - same error-handling
	// stance as browseSharePointFolders above (throw with the server's real message rather than
	// returning an empty list indistinguishable from "there are genuinely no lists").
	async browseSharePointLists(): Promise<string[]> {
		const res = await fetch(`${BASE}/sharepoint/lists`)
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { message?: string } | null
			throw new Error(body?.message ?? `Henting av lister feilet (HTTP ${res.status})`)
		}
		const { lists } = (await res.json()) as { lists: string[] }
		return lists
	}
}
