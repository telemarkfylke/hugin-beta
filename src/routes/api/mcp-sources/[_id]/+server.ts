import { json, type RequestHandler } from "@sveltejs/kit"
import { canEditMcpSource, canUseMcpSharepoint } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getMcpSourceStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { NewMcpSource } from "$lib/types/mcp-source"
import { McpSourceInputSchema } from "$lib/types/mcp-source"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const mcpSourceStore = getMcpSourceStore()

const replaceMcpSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use MCP data sources")
	}

	const sourceId = requestEvent.params._id
	if (!sourceId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const existing = await mcpSourceStore.getMcpSource(sourceId)
	if (!existing) {
		throw new HTTPError(404, "MCP source not found")
	}
	if (!canEditMcpSource(existing, user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to edit this MCP source")
	}

	const body = await requestEvent.request.json()
	const input = McpSourceInputSchema.parse(body)

	const sourceToReplace: NewMcpSource = {
		...input,
		createdBy: existing.createdBy,
		createdAt: existing.createdAt,
		updatedAt: new Date().toISOString()
	}

	const updated = await mcpSourceStore.replaceMcpSource(sourceId, sourceToReplace)

	return {
		isAuthorized: true,
		response: json(updated)
	}
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceMcpSource)
}

const deleteMcpSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use MCP data sources")
	}

	const sourceId = requestEvent.params._id
	if (!sourceId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const existing = await mcpSourceStore.getMcpSource(sourceId)
	if (!existing) {
		throw new HTTPError(404, "MCP source not found")
	}
	if (!canEditMcpSource(existing, user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to delete this MCP source")
	}

	await mcpSourceStore.deleteMcpSource(sourceId)

	return {
		isAuthorized: true,
		response: json({ message: "MCP source deleted" })
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteMcpSource)
}
