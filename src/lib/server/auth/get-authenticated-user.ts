// https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities

import { type AuthenticatedUser, MSPrincipalClaims } from "$lib/types/authentication"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "./auth-constants"
import { injectMockAuthenticatedUserHeaders, MOCK_AUTH } from "./mock-authenticated-user"

export const getPrincipalClaims = (base64EncodedHeaderValue: string): MSPrincipalClaims => {
	if (!base64EncodedHeaderValue) {
		throw new Error("No base64 encoded header is required to get principal claims")
	}
	const jsonString = Buffer.from(base64EncodedHeaderValue, "base64").toString("utf-8")
	try {
		const principalClaims = JSON.parse(jsonString)
		// Validate the parsed object structure if needed
		return MSPrincipalClaims.parse(principalClaims)
	} catch (error) {
		throw new Error(`Failed to parse principal claims from base64 encoded header value: ${error}`)
	}
}

export const getAuthenticatedUser = (headers: Headers): AuthenticatedUser => {
	if (MOCK_AUTH) {
		headers = injectMockAuthenticatedUserHeaders(headers)
	}
	const base64EncodedHeaderValue = headers.get(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)
	if (!base64EncodedHeaderValue) {
		throw new Error(`Missing ${MS_AUTH_PRINCIPAL_CLAIMS_HEADER} header, cannot get authenticated user`)
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
