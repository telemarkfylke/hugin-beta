import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canManageUsageLimits } from "$lib/authorization"
import { getUsageLimitsStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getUsageLimitsSnapshot, invalidateUsageLimits } from "$lib/usagebudget/server/usage-limits"
import { UsageLimitsSchema } from "$lib/usagebudget/types"

// The whole settings document every time - a partial body would otherwise leave the server guessing
// which fields to keep
const saveUsageLimits: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canManageUsageLimits(user)) {
		throw new HTTPError(403, "Not authorized to manage usage limits")
	}
	const input = UsageLimitsSchema.safeParse(await requestEvent.request.json().catch(() => null))
	if (!input.success) {
		throw new HTTPError(400, `Invalid usage limits: ${input.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`)
	}

	await getUsageLimitsStore().saveUsageLimits(input.data, { id: user.userId, name: user.name })
	invalidateUsageLimits()
	logger.info("Usage limits set to {limits} by {userId}", JSON.stringify(input.data), user.userId)

	return { isAuthorized: true, response: json((await getUsageLimitsSnapshot()).settings) }
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, saveUsageLimits)
}
