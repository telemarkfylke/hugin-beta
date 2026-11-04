import type { AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

// Which role may use which feature lives ONLY in the database (collection "feature-flags", edited on
// /admin/features) - this file just names the features the code knows how to check. There are
// deliberately no default values here: a feature missing from the DB is created with every role off
// (see feature-access.ts), so the DB is always the complete picture.
//
// Only "may this role use the feature at all" belongs here. Security and ownership rules
// (canSetAnonymousEmbed, canManageMcpSources, canEdit*/canUpdate*) stay in $lib/authorization -
// one checkbox must never be able to open those up.
export const FEATURE_KEYS = ["canvas", "ragservice", "mcpSharepoint", "websiteSources", "transcription", "history"] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]

export const FEATURES: Record<FeatureKey, { label: string; description: string }> = {
	canvas: { label: "Kladdeboka", description: "Kladdeboka (dokument, tegning, presentasjon) og /api/canvas" },
	ragservice: { label: "Dokumentsøk", description: "Datakilder > Dokumentsøk, og å koble dokumentsøk til en assistent. Den som har tilgang kan også opprette egne bibliotek" },
	mcpSharepoint: { label: "SharePoint (MCP)", description: "Velge MCP-kilder på en assistent og chatte med assistenter som har dem. Å administrere kildene er alltid kun admin" },
	websiteSources: { label: "Nettsider som kilde", description: "Velge nettside-kilder på en assistent og chatte med assistenter som har dem. Å administrere kildene er alltid kun admin" },
	transcription: { label: "Tale-til-notat", description: "Tale-til-notat og /api/transcription" },
	history: { label: "Samtalehistorikk", description: "Lagrede samtaler. Uten tilgang er inkognito tvunget på og historikken skjult" }
}

// Admin is not a column: admins always have every feature (see resolveUserFeatures), so nobody can
// lock themselves out of /admin/features.
export const FEATURE_ROLES = ["employee", "edu_employee", "student"] as const
export type FeatureRole = (typeof FEATURE_ROLES)[number]

export const FEATURE_ROLE_LABELS: Record<FeatureRole, string> = {
	employee: "Ansatt",
	edu_employee: "Skoleansatt",
	student: "Elev"
}

const APP_ROLE_KEYS: Record<FeatureRole, keyof AppRoles> = {
	employee: "EMPLOYEE",
	edu_employee: "EDU_EMPLOYEE",
	student: "STUDENT"
}

export type FeatureRoleAccess = Record<FeatureRole, boolean>

export type FeatureFlag = {
	feature: FeatureKey
	roles: FeatureRoleAccess
	// null for a feature that was created automatically and never edited
	updatedAt: Date | null
	updatedBy: { id: string; name: string } | null
}

// What one user may use - resolved server-side and handed to the client via the root layout
export type UserFeatures = Record<FeatureKey, boolean>

export const isFeatureKey = (value: unknown): value is FeatureKey => FEATURE_KEYS.includes(value as FeatureKey)

export const NO_FEATURE_ROLES: FeatureRoleAccess = { employee: false, edu_employee: false, student: false }

export const NO_FEATURES = Object.fromEntries(FEATURE_KEYS.map((feature) => [feature, false])) as UserFeatures

// A user has a feature if ANY of their roles has it - so "everyone but student-only users" is just
// employee + edu_employee, someone who is both student and edu_employee gets in through the latter.
export const resolveUserFeatures = (user: AuthenticatedPrincipal, appRoles: AppRoles, flags: FeatureFlag[]): UserFeatures => {
	const isAdmin = user.roles.includes(appRoles.ADMIN)
	return Object.fromEntries(
		FEATURE_KEYS.map((feature) => {
			const roles = flags.find((flag) => flag.feature === feature)?.roles ?? NO_FEATURE_ROLES
			return [feature, isAdmin || FEATURE_ROLES.some((role) => roles[role] && user.roles.includes(appRoles[APP_ROLE_KEYS[role]]))]
		})
	) as UserFeatures
}
