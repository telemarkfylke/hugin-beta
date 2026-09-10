import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseMcpSharepoint } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getSharepointMcpClient } from "$lib/server/mcp/mcp-client"
import { parseFolderList } from "$lib/server/mcp/parse-sharepoint-folder-list"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Admin-only folder browser backing McpFolderBrowser.svelte - lets someone setting up a
// SharePoint MCP source pick a real, correctly-spelled folder path instead of typing one by hand
// (a typo in a hand-typed path would silently make a scope entry match nothing, with no error
// anywhere - see mcp-source.ts). Gated by the same canUseMcpSharepoint check as using MCP at all;
// this doesn't expose anything beyond what that gate already implies today (see the discussion
// in the session this was built - the MCP connection is one shared, unscoped service credential,
// not per-user delegated access, so "can configure an MCP source" already means "can see anything
// this credential can see"). Response parsing lives in parse-sharepoint-folder-list.ts, not here -
// +server.ts modules may only export recognized route handlers (GET/POST/...), SvelteKit rejects
// any other export at runtime.
const browseSharePointFolders: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to browse SharePoint")
	}

	const parentFolder = requestEvent.url.searchParams.get("parent_folder") ?? ""

	const client = await getSharepointMcpClient()
	if (!client) {
		throw new HTTPError(503, "SharePoint MCP is not configured")
	}

	const text = await client.callTool("List_SharePoint_Folders", { parent_folder: parentFolder })
	const folders = parseFolderList(text, parentFolder)

	return {
		isAuthorized: true,
		response: json({ parentFolder, folders })
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, browseSharePointFolders)
}
