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

const getWebsiteSources: ApiNextFunction = async ({ user }) => {
	if (!canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use website data sources")
	}
	const sources = await websiteSourceStore.getWebsiteSources(user)
	return {
		isAuthorized: true,
		response: json(sources)
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getWebsiteSources)
}

const createWebsiteSource: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	if (!canUseWebsiteDataSource(user, APP_CONFIG.APP_ROLES)) {
		throw new HTTPError(403, "Not authorized to use website data sources")
	}

	const body = await requestEvent.request.json()
	const input = WebsiteSourceInputSchema.parse(body)

	const now = new Date().toISOString()
	const sourceToCreate: NewWebsiteSource = {
		name: input.name,
		type: input.type,
		entries: input.entries,
		createdBy: { id: user.userId, name: user.name },
		createdAt: now,
		updatedAt: now
	}

	const newSource = await websiteSourceStore.createWebsiteSource(sourceToCreate)

	return {
		isAuthorized: true,
		response: json(newSource)
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, createWebsiteSource)
}
