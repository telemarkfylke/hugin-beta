import { MS_PRINCIPAL_CLAIM_TYPS } from "$lib/server/auth/auth-constants"
import type { MSPrincipalClaim, MSPrincipalClaims } from "$lib/types/authentication"

export class AuthPrincipalParseError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "AuthPrincipalParseError"
	}
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const parseClaim = (claim: unknown): MSPrincipalClaim => {
	if (!isObject(claim)) {
		throw new AuthPrincipalParseError("Principal claim must be an object")
	}
	if (typeof claim.typ !== "string") {
		throw new AuthPrincipalParseError("Principal claim typ must be a string")
	}
	if (typeof claim.val !== "string") {
		throw new AuthPrincipalParseError("Principal claim val must be a string")
	}
	return {
		typ: claim.typ as MSPrincipalClaim["typ"],
		val: claim.val
	}
}

export const parsePrincipalClaimsObject = (input: unknown): MSPrincipalClaims => {
	if (!isObject(input)) {
		throw new AuthPrincipalParseError("Principal claims is not a valid object")
	}
	if (typeof input.auth_typ !== "string" || input.auth_typ.length === 0) {
		throw new AuthPrincipalParseError("Principal claims object is missing required property auth_typ")
	}
	if (!Array.isArray(input.claims)) {
		throw new AuthPrincipalParseError("Principal claims 'claims' property is not an array")
	}
	if (typeof input.name_typ !== "string" || input.name_typ.length === 0) {
		throw new AuthPrincipalParseError("Principal claims object is missing required property name_typ")
	}
	if (typeof input.role_typ !== "string" || input.role_typ.length === 0) {
		throw new AuthPrincipalParseError("Principal claims object is missing required property role_typ")
	}
	return {
		auth_typ: input.auth_typ,
		claims: input.claims.map(parseClaim),
		name_typ: input.name_typ,
		role_typ: input.role_typ
	}
}

export const getUnknownClaimTypes = (claims: MSPrincipalClaims): string[] => {
	return claims.claims.map((claim) => claim.typ).filter((typ) => !MS_PRINCIPAL_CLAIM_TYPS.includes(typ))
}
