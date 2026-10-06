import type { AppRoles } from "$lib/types/app-config"

// "Opplev Hugin som" - lets a user with the QA app role temporarily see/use Hugin as another
// role, so product owners and testers can check what a student/employee actually gets without
// running Hugin locally with MOCK_AUTH_ROLES. Gated purely by the Entra role assignment: QA is
// meant to be assigned in test environments only, and nobody holds it in prod. Holding QA
// effectively means "can become any role in ROLE_PREVIEW_ROLES" - ADMIN is deliberately not in it.
// See $lib/server/auth/role-preview for where the effective roles are swapped in.

export const ROLE_PREVIEW_COOKIE = "hugin_role_preview"

export const ROLE_PREVIEW_ROLES = ["AGENT_MAINTAINER", "EMPLOYEE", "EDU_EMPLOYEE", "STUDENT"] as const satisfies readonly (keyof AppRoles)[]
export type RolePreviewRole = (typeof ROLE_PREVIEW_ROLES)[number]

export const ROLE_PREVIEW_LABELS: Record<RolePreviewRole, string> = {
	AGENT_MAINTAINER: "Agentforvalter",
	EMPLOYEE: "Ansatt",
	EDU_EMPLOYEE: "Skole-ansatt",
	STUDENT: "Elev"
}

export const isRolePreviewRole = (value: unknown): value is RolePreviewRole => ROLE_PREVIEW_ROLES.includes(value as RolePreviewRole)

/** Starts (role) or ends (null) the preview, then reloads Hugin from the front page. */
export const setRolePreview = async (role: RolePreviewRole | null): Promise<void> => {
	const response = await fetch("/api/role-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })
	if (!response.ok) {
		throw new Error(`Failed to set role preview: ${response.status}`)
	}
	// Full reload rather than invalidateAll - ChatState, the menu's agent list etc. hold role-dependent
	// data client-side. And to "/" rather than the current page, which the new role may not have access to.
	window.location.href = "/"
}
