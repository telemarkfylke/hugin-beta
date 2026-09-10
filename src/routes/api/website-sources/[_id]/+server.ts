import { json, type RequestHandler } from "@sveltejs/kit"
import { canUseWebsiteDataSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getWebsiteSourceStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import type { NewWebsiteSource } from "$lib/types/website-source"
import { WebsiteSourceInputSchema } from "$lib/types/website-source"

const websiteSourceStore = getWebsiteSourceStore()

const replaceWebsiteSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use website data sources")
	}

	const sourceId = requestEvent.params._id
	if (!sourceId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const existing = await websiteSourceStore.getWebsiteSource(sourceId)
	if (!existing) {
		throw new HTTPError(404, "Website source not found")
	}

	const body = await requestEvent.request.json()
	const input = WebsiteSourceInputSchema.parse(body)

	const sourceToReplace: NewWebsiteSource = {
		name: input.name,
		entries: input.entries,
		createdBy: existing.createdBy,
		createdAt: existing.createdAt,
		updatedAt: new Date().toISOString()
	}

	const updated = await websiteSourceStore.replaceWebsiteSource(sourceId, sourceToReplace)

	return {
		isAuthorized: true,
		response: json(updated)
	}
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, replaceWebsiteSource)
}

const deleteWebsiteSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use website data sources")
	}

	const sourceId = requestEvent.params._id
	if (!sourceId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const existing = await websiteSourceStore.getWebsiteSource(sourceId)
	if (!existing) {
		throw new HTTPError(404, "Website source not found")
	}

	await websiteSourceStore.deleteWebsiteSource(sourceId)

	return {
		isAuthorized: true,
		response: json({ message: "Website source deleted" })
	}
}

export const DELETE: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, deleteWebsiteSource)
}
