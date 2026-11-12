import { json, type RequestHandler } from "@sveltejs/kit"
import { hasFeature } from "$lib/featureflags/server/feature-access"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { summarizeRagContext } from "$lib/server/ragservice/rag-file-content"
import { getRagStoreSearchInfos, resolveRagAuth } from "$lib/server/ragservice/rag-search"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getUsageLimits } from "$lib/usagebudget/server/usage-limits"

// Upper bound on stores per request - a bot has a handful, this just keeps one call from fanning out unbounded
const MAX_STORES = 20

/**
 * GET ?storeIds=a,b - what a bot with these ragservice datasources would get (attached whole, searched, left out),
 * for the bot setup panel. Read with the caller's own access, the same way the chat reads it, and only file names
 * and sizes come back - never content.
 */
const getRagSummary: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!(await hasFeature(user, "ragservice"))) {
		throw new HTTPError(403, "Ikke tilgang til datakilder")
	}
	const storeIds = [...new Set((requestEvent.url.searchParams.get("storeIds") ?? "").split(",").filter(Boolean))]
	// Store ids go into ragservice URL paths - ids only, no path tricks
	if (storeIds.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) {
		throw new HTTPError(400, "Ugyldig datakilde-id")
	}
	if (storeIds.length > MAX_STORES) {
		throw new HTTPError(400, `For mange datakilder (maks ${MAX_STORES})`)
	}

	const auth = await resolveRagAuth(user, requestEvent.request.headers.get(MS_AUTH_TOKEN_HEADER))
	const infos = await getRagStoreSearchInfos(storeIds, auth)
	const { maxFileContentCharacters } = await getUsageLimits()

	return { isAuthorized: true, response: json(summarizeRagContext(infos, maxFileContentCharacters)) }
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getRagSummary)
}
