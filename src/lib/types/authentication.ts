import z from "zod"

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

export const AuthenticatedPrincipalSchema = z.object({
	/** ObjectId in EntraID */
	userId: z.string(),
	name: z.string(),
	/** Whatever the preferred username is, don't rely on this for unique identification */
	preferredUserName: z.string(),
	/** list of roles (values) the user has */
	roles: z.array(z.string()),
	/** list of groupIds the user belongs to */
	groups: z.array(z.string())
})

export type AuthenticatedPrincipal = z.infer<typeof AuthenticatedPrincipalSchema>
