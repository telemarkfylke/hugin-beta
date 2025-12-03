import z from "zod"

export const MSUserClaim = z.object({
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
