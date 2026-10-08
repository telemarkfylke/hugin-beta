import { isRolePreviewRole, ROLE_PREVIEW_COOKIE, type RolePreviewRole } from "$lib/role-preview"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

// Server half of "Opplev Hugin som" (see $lib/role-preview). The previewed roles are swapped into
// the principal itself (getAuthenticatedPrincipal), not just hidden in the UI - so every
// authorization check, API route and store query behaves exactly as for a real user with that role.

export const canUseRolePreview = (realPrincipal: AuthenticatedPrincipal): boolean => realPrincipal.roles.includes(APP_CONFIG.APP_ROLES.QA)

// Real agent maintainers also hold EMPLOYEE (several feature gates - canvas, ragservice, MCP - check
// EMPLOYEE, not AGENT_MAINTAINER), so previewing AGENT_MAINTAINER alone would show a misleadingly
// restricted Hugin.
const previewRoles = (role: RolePreviewRole): string[] => {
	if (role === "AGENT_MAINTAINER") {
		return [APP_CONFIG.APP_ROLES.AGENT_MAINTAINER, APP_CONFIG.APP_ROLES.EMPLOYEE]
	}
	return [APP_CONFIG.APP_ROLES[role]]
}

const readCookie = (headers: Headers, name: string): string | undefined => {
	const cookieHeader = headers.get("cookie")
	if (!cookieHeader) {
		return undefined
	}
	for (const part of cookieHeader.split(";")) {
		const [key, ...valueParts] = part.trim().split("=")
		if (key === name) {
			return decodeURIComponent(valueParts.join("="))
		}
	}
	return undefined
}

/**
 * Returns the principal as it should be seen by the rest of the app: unchanged, unless the real
 * principal holds QA and has a valid preview cookie - then roles are replaced by the previewed
 * role(s) and groups are cleared (a student isn't in the tester's Entra groups, so keeping them
 * would show agents shared via group that the previewed role would never see).
 */
export const applyRolePreview = (realPrincipal: AuthenticatedPrincipal, headers: Headers): AuthenticatedPrincipal => {
	if (!canUseRolePreview(realPrincipal)) {
		return realPrincipal
	}
	const role = readCookie(headers, ROLE_PREVIEW_COOKIE)
	if (!isRolePreviewRole(role)) {
		return realPrincipal
	}
	return { ...realPrincipal, roles: previewRoles(role), groups: [], rolePreview: role }
}
