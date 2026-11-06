import z from "zod"
import { ROLE_PREVIEW_ROLES } from "$lib/role-preview"

/**
 * @links
 * https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities
 * https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
 */
export type MSPrincipalClaimTyp =
	| "aud"
	| "iss"
	| "iat"
	| "nbf"
	| "exp"
	| "aio"
	| "c_hash"
	| "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
	| "groups"
	| "name"
	| "nonce"
	| "http://schemas.microsoft.com/identity/claims/objectidentifier"
	| "preferred_username"
	| "rh"
	| "sid"
	| "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
	| "http://schemas.microsoft.com/identity/claims/tenantid"
	| "uti"
	| "ver"
	| "roles"
	| "cc"

export type MSPrincipalClaim = {
	typ: MSPrincipalClaimTyp
	val: string
}

export type MSPrincipalClaims = {
	auth_typ: string
	claims: MSPrincipalClaim[]
	name_typ: string
	role_typ: string
}

// Entra hands us one flat list of app roles, but it holds two separate things (split at login, see
// $lib/server/auth/principal-roles):
// - affiliation ("tilknytning"): who you are in the county - decides which features you get
//   ($lib/featureflags) and which published agents/spotlights reach you (accessGroups).
// - Hugin roles: what you may administer or test inside Hugin - decides the rules in $lib/authorization.
export const AFFILIATIONS = ["employee", "edu_employee", "student"] as const
export type Affiliation = (typeof AFFILIATIONS)[number]

export const HUGIN_ROLES = ["admin", "agentMaintainer", "qa"] as const
export type HuginRole = (typeof HUGIN_ROLES)[number]

export const AuthenticatedPrincipalSchema = z.object({
	/** ObjectId in EntraID */
	userId: z.string(),
	name: z.string(),
	/** Whatever the preferred username is, don't rely on this for unique identification */
	preferredUserName: z.string(),
	/** employee / edu_employee / student - see AFFILIATIONS above */
	affiliations: z.array(z.enum(AFFILIATIONS)),
	/** admin / agentMaintainer / qa - see HUGIN_ROLES above */
	huginRoles: z.array(z.enum(HUGIN_ROLES)),
	/** list of groupIds the user is a member of */
	groups: z.array(z.string()),
	/** Set when a QA user is previewing Hugin as another role ("Opplev Hugin som") - affiliations, huginRoles and groups above are then the previewed ones, not the real ones */
	rolePreview: z.enum(ROLE_PREVIEW_ROLES).optional()
})

export type AuthenticatedPrincipal = z.infer<typeof AuthenticatedPrincipalSchema>
