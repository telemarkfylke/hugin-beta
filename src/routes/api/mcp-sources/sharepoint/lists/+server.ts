import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseMcpSharepoint } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getSharepointMcpClient } from "$lib/server/mcp/mcp-client"
import { parseListNames } from "$lib/server/mcp/parse-sharepoint-list-names"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Admin-only proxy to List_SharePoint_Lists, backing the list picker in McpSourceForm.svelte - same
// role as api/mcp-sources/sharepoint/browse does for folders. This tool is NEVER exposed to the
// model at chat time (see scoped-sharepoint-client.ts's module comment: it takes no scoping
// argument at all, so calling it here - where the caller already has to see every list to choose
// from, same trust level as browsing SharePoint directly - is the only place it's ever called).
// Gated by the same canUseMcpSharepoint check as using MCP at all, same reasoning as the folder
// browse route: this doesn't expose anything beyond what that gate already implies.
const listSharePointLists: ApiNextFunction = async ({ user }) => {
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to browse SharePoint")
	}

	const client = await getSharepointMcpClient()
	if (!client) {
		throw new HTTPError(503, "SharePoint MCP is not configured")
	}

	const text = await client.callTool("List_SharePoint_Lists", {})
	const lists = parseListNames(text)

	return {
		isAuthorized: true,
		response: json({ lists })
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, listSharePointLists)
}
