import { error } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { getAuthenticatedUser } from "$lib/server/auth/get-authenticated-user"
import type { MSPrincipalClaims } from "$lib/types/authentication"
import type { PageServerLoad } from "./$types"

const ADMIN_ROLE = env.HUGIN_BETA_ADMIN_ROLE
if (!ADMIN_ROLE) {
	logger.error("HUGIN_BETA_ADMIN_ROLE is not set in environment variables, cannot proceed")
	throw new Error("HUGIN_BETA_ADMIN_ROLE is not set in environment variables, cannot proceed")
}

logger.info("Admin role for Hugin Beta is set to {adminRole}:", ADMIN_ROLE)

export const load: PageServerLoad = async ({ request }): Promise<MSPrincipalClaims> => {
	try {
		const userClaims = getAuthenticatedUser(request.headers)
		if (!userClaims) {
			error(401, "User not authenticated")
		}
		if (!userClaims.claims || userClaims.claims.length === 0) {
			error(403, "User has no claims, access forbidden")
		}
		if (!userClaims.claims.find((claim) => claim.typ === "roles")) {
			error(403, "User has no roles claim, access forbidden")
		}
		// Check if user has admin role
		const userRoles = userClaims.claims.filter((claim) => claim.typ === "roles").map((claim) => claim.val)
		if (!userRoles.includes(ADMIN_ROLE)) {
			error(403, "User does not have admin role, access forbidden")
		}

		return userClaims
	} catch (err) {
		logger.errorException(err, "Error in admin page load")
		return error(500, `Internal server error ${err instanceof Error ? err.message : ""}`)
	}
}
