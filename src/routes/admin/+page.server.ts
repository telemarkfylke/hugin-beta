import { error } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { getPrincipalClaims } from "$lib/server/auth/get-authenticated-user"
import type { MSPrincipalClaims } from "$lib/types/authentication"
import type { PageServerLoad } from "./$types"

const ADMIN_ROLE = env.APP_ROLE_ADMIN
if (!ADMIN_ROLE) {
	logger.error("HUGIN_BETA_ADMIN_ROLE is not set in environment variables, cannot proceed")
	throw new Error("HUGIN_BETA_ADMIN_ROLE is not set in environment variables, cannot proceed")
}

logger.info("Admin role for Hugin Beta is set to {adminRole}:", ADMIN_ROLE)

export const load: PageServerLoad = async ({ request }): Promise<{ claims: MSPrincipalClaims }> => {
	const userClaimsHeaderValue = request.headers.get(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)
	if (!userClaimsHeaderValue) {
		error(401, "Missing claims in request headers")
	}
	const userClaims = getPrincipalClaims(userClaimsHeaderValue)
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
	return { claims: userClaims }
}
