import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseMcpSharepoint } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getMcpSourceStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { NewMcpSource } from "$lib/types/mcp-source"
import { McpSourceInputSchema } from "$lib/types/mcp-source"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const mcpSourceStore = getMcpSourceStore()

const getMcpSources: ApiNextFunction = async ({ user }) => {
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use MCP data sources")
	}
	const sources = await mcpSourceStore.getMcpSources()
	return {
		isAuthorized: true,
		response: json(sources)
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getMcpSources)
}

const createMcpSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseMcpSharepoint(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use MCP data sources")
	}

	const body = await requestEvent.request.json()
	const input = McpSourceInputSchema.parse(body)

	const now = new Date().toISOString()
	const sourceToCreate: NewMcpSource = {
		...input,
		createdBy: { id: user.userId, name: user.name },
		createdAt: now,
		updatedAt: now
	}

	const newSource = await mcpSourceStore.createMcpSource(sourceToCreate)

	return {
		isAuthorized: true,
		response: json(newSource)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createMcpSource)
}
