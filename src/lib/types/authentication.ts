import z from "zod"

/**
 * @links
 * https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities
 * https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
 */
export const MSUserClaim = z.discriminatedUnion("typ", [
	z.object({
		typ: z.literal("aud"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("iss"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("iat"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("nbf"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("exp"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("aio"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("c_hash"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("groups"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("name"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("nonce"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("http://schemas.microsoft.com/identity/claims/objectidentifier"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("preferred_username"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("rh"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("sid"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("http://schemas.microsoft.com/identity/claims/tenantid"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("uti"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("ver"),
		val: z.string()
	}),
	z.object({
		typ: z.literal("roles"),
		val: z.string()
	})
])

export const MSUserClaimOLD = z.object({
	typ: z.string(),
	val: z.string()
})

export type MSUserClaim = z.infer<typeof MSUserClaim>

export const MSPrincipalClaims = z.object({
	auth_typ: z.string(),
	claims: z.array(MSUserClaim),
	name_typ: z.string(),
	role_typ: z.string()
})

export type MSPrincipalClaims = z.infer<typeof MSPrincipalClaims>

export const AuthenticatedUser = z.object({
	/** ObjectId in EntraID */
	userId: z.uuid(),
	name: z.string(),
	/** Whatever the preferred username is, don't rely on this for unique identification */
	preferredUserName: z.string(),
	/** list of roles (values) the user has */
	roles: z.array(z.string()),
	/** list of groupIds the user belongs to */
	groups: z.array(z.uuid())
})

export type AuthenticatedUser = z.infer<typeof AuthenticatedUser>
