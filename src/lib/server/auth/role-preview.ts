import { isRolePreviewRole, ROLE_PREVIEW_COOKIE, type RolePreviewRole } from "$lib/role-preview"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

// Server half of "Opplev Hugin som" (see $lib/role-preview). The previewed roles are swapped into
// the principal itself (getAuthenticatedPrincipal), not just hidden in the UI - so every
// authorization check, API route and store query behaves exactly as for a real user with that role.

export const canUseRolePreview = (realPrincipal: AuthenticatedPrincipal): boolean => realPrincipal.huginRoles.includes("qa")

// A preview replaces BOTH dimensions: previewing "Elev" as an admin+QA user must drop admin too, or
// it shows Hugin as no real student sees it. QA disappears with it - switching the preview off
// again is checked against the real principal (see /api/role-preview). Agent maintainers are
// employees in real life, so that's the affiliation they're previewed with.
const PREVIEW_PRINCIPAL_ROLES: Record<RolePreviewRole, Pick<AuthenticatedPrincipal, "affiliations" | "huginRoles">> = {
	AGENT_MAINTAINER: { affiliations: ["employee"], huginRoles: ["agentMaintainer"] },
	EMPLOYEE: { affiliations: ["employee"], huginRoles: [] },
	EDU_EMPLOYEE: { affiliations: ["edu_employee"], huginRoles: [] },
	STUDENT: { affiliations: ["student"], huginRoles: [] }
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
	return { ...realPrincipal, ...PREVIEW_PRINCIPAL_ROLES[role], groups: [], rolePreview: role }
}
