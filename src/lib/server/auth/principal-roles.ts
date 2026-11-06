import type { AppRoles } from "$lib/types/app-config"
import type { Affiliation, HuginRole } from "$lib/types/authentication"

// The one place Entra's flat app-role list is split into the two dimensions on AuthenticatedPrincipal
// (see AFFILIATIONS/HUGIN_ROLES in $lib/types/authentication). The actual Entra role values come from
// env (APP_ROLE_*), hence the indirection through AppRoles keys.
const AFFILIATION_APP_ROLES: Record<Affiliation, keyof AppRoles> = {
	employee: "EMPLOYEE",
	edu_employee: "EDU_EMPLOYEE",
	student: "STUDENT"
}

const HUGIN_ROLE_APP_ROLES: Record<HuginRole, keyof AppRoles> = {
	admin: "ADMIN",
	agentMaintainer: "AGENT_MAINTAINER",
	qa: "QA"
}

// Entra roles we don't know are dropped - nothing downstream looks at raw role strings anymore
export const splitAppRoles = (roles: string[], appRoles: AppRoles): { affiliations: Affiliation[]; huginRoles: HuginRole[] } => ({
	affiliations: (Object.keys(AFFILIATION_APP_ROLES) as Affiliation[]).filter((affiliation) => roles.includes(appRoles[AFFILIATION_APP_ROLES[affiliation]])),
	huginRoles: (Object.keys(HUGIN_ROLE_APP_ROLES) as HuginRole[]).filter((role) => roles.includes(appRoles[HUGIN_ROLE_APP_ROLES[role]]))
})
