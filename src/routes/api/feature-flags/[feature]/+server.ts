import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import z from "zod"
import { canManageFeatureFlags } from "$lib/authorization"
import { invalidateFeatureFlags } from "$lib/featureflags/server/feature-access"
import { isFeatureKey } from "$lib/featureflags/types"
import { getFeatureFlagStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Every role must be sent explicitly - a partial body would otherwise silently turn the rest off
const FeatureRolesInputSchema = z.object({
	roles: z.object({ employee: z.boolean(), edu_employee: z.boolean(), student: z.boolean() }).strict()
})

const setFeatureRoles: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canManageFeatureFlags(user)) {
		throw new HTTPError(403, "Not authorized to manage feature flags")
	}
	const feature = requestEvent.params.feature
	if (!isFeatureKey(feature)) {
		throw new HTTPError(404, "Unknown feature")
	}
	const input = FeatureRolesInputSchema.safeParse(await requestEvent.request.json().catch(() => null))
	if (!input.success) {
		throw new HTTPError(400, "Body must be { roles: { employee, edu_employee, student } } with booleans")
	}

	const updated = await getFeatureFlagStore().setFeatureRoles(feature, input.data.roles, { id: user.userId, name: user.name })
	invalidateFeatureFlags()
	logger.info("Feature flag {feature} set to {roles} by {userId}", feature, JSON.stringify(input.data.roles), user.userId)

	return { isAuthorized: true, response: json(updated) }
}

export const PUT: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, setFeatureRoles)
}
