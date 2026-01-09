// https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities

import { logger } from "@vestfoldfylke/loglady"
import { type AuthenticatedPrincipal, type MSPrincipalClaims } from "$lib/types/authentication"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER, MS_PRINCIPAL_CLAIM_TYPS } from "./auth-constants"
import { injectMockAuthenticatedUserHeaders, MOCK_AUTH } from "./mock-authenticated-user"

export const getPrincipalClaims = (base64EncodedHeaderValue: string): MSPrincipalClaims => {
	if (!base64EncodedHeaderValue) {
		throw new Error("No base64 encoded header is required to get principal claims")
	}
	const jsonString = Buffer.from(base64EncodedHeaderValue, "base64").toString("utf-8")
	let parsedPrincipalClaims: unknown
	try {
		parsedPrincipalClaims = JSON.parse(jsonString)
	} catch (error) {
		throw new Error(`Failed to JSON.parse principal claims from base64 encoded header value: ${error}`)
	}
	if (typeof parsedPrincipalClaims !== "object" || parsedPrincipalClaims === null) {
		throw new Error("Principal claims is not a valid object")
	}
	const principalClaims: MSPrincipalClaims = parsedPrincipalClaims as MSPrincipalClaims

	if (!principalClaims.auth_typ || !principalClaims.claims || !principalClaims.name_typ || !principalClaims.role_typ) {
		logger.error("Principal claims object is missing required properties (auth_typ, claims, name_typ, role_typ): {@principalClaims}", principalClaims)
		throw new Error("Principal claims object is missing required properties")
	}
	if (!Array.isArray(principalClaims.claims)) {
		throw new Error("Principal claims 'claims' property is not an array")
	}
	for (const claim of principalClaims.claims) {
		if (!MS_PRINCIPAL_CLAIM_TYPS.includes(claim.typ)) {
			logger.warn("Unknown claim type found in principal claims: {claimType}", claim.typ)
		}
	}
	
	return principalClaims as MSPrincipalClaims
}

export const getAuthenticatedPrincipal = (headers: Headers): AuthenticatedPrincipal => {
	if (MOCK_AUTH) {
		headers = injectMockAuthenticatedUserHeaders(headers)
	}
	const base64EncodedHeaderValue = headers.get(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)
	if (!base64EncodedHeaderValue) {
		throw new Error(`Missing ${MS_AUTH_PRINCIPAL_CLAIMS_HEADER} header, cannot get authenticated principal`)
	}

	const principalClaims = getPrincipalClaims(base64EncodedHeaderValue)
	const userId = principalClaims.claims.find((claim) => claim.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier")?.val
	if (!userId) {
		throw new Error("User ID claim is missing in principal claims")
	}
	const preferredUserName = principalClaims.claims.find((claim) => claim.typ === "preferred_username")?.val || "unknown"
	const name = principalClaims.claims.find((claim) => claim.typ === "name")?.val
	if (!name) {
		throw new Error("Name claim is missing in principal claims")
	}
	const roles = principalClaims.claims.filter((claim) => claim.typ === "roles").map((claim) => claim.val)
	if (roles.length === 0) {
		throw new Error("No roles found in principal claims")
	}
	const groups = principalClaims.claims.filter((claim) => claim.typ === "groups").map((claim) => claim.val)

	return {
		userId,
		preferredUserName,
		name,
		roles,
		groups
	}
}
