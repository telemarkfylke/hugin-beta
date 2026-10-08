import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { isRolePreviewRole, ROLE_PREVIEW_COOKIE } from "$lib/role-preview"
import { getRealAuthenticatedPrincipal } from "$lib/server/auth/get-authenticated-user"
import { canUseRolePreview } from "$lib/server/auth/role-preview"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Starts/stops "Opplev Hugin som" (see $lib/role-preview). Body: { role: RolePreviewRole | null } -
// null ends the preview.
const setRolePreview: ApiNextFunction = async ({ requestEvent, user }) => {
	// Must check the REAL roles: `user` already has any active preview applied, and a previewed
	// role never includes QA - checking `user` would lock the tester out of switching back.
	const realUser = getRealAuthenticatedPrincipal(requestEvent.request.headers)
	if (!canUseRolePreview(realUser)) {
		return { isAuthorized: false, response: json({ message: "Forbidden" }, { status: 403 }) }
	}

	const body = (await requestEvent.request.json().catch(() => null)) as { role?: unknown } | null
	const role = body?.role
	if (role === null) {
		requestEvent.cookies.delete(ROLE_PREVIEW_COOKIE, { path: "/" })
		logger.info("Role preview ended for user {userId} (was {previousRole})", realUser.userId, user.rolePreview ?? "none")
		return { isAuthorized: true, response: json({ role: null }) }
	}
	if (!isRolePreviewRole(role)) {
		throw new HTTPError(400, "role must be one of the previewable roles, or null")
	}

	// Session cookie (no maxAge) - the preview ends by itself when the browser is closed.
	requestEvent.cookies.set(ROLE_PREVIEW_COOKIE, role, { path: "/", httpOnly: true, sameSite: "lax" })
	logger.info("Role preview started for user {userId} as {role}", realUser.userId, role)
	return { isAuthorized: true, response: json({ role }) }
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, setRolePreview)
}
