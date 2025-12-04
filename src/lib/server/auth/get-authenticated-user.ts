// https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities

import type { MSPrincipalClaims } from "$lib/types/authentication"
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
		// TEMP disable const validatedMSClaims = MSPrincipalClaims.parse(principalClaims)
		return principalClaims
	} catch (error) {
		throw new Error(`Failed to parse principal claims from base64 encoded header value: ${error}`)
	}
}

export const getAuthenticatedUser = (headers: Headers): MSPrincipalClaims => {
	if (MOCK_AUTH) {
		headers = injectMockAuthenticatedUserHeaders(headers)
	}
	const base64EncodedHeaderValue = headers.get(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)
	if (!base64EncodedHeaderValue) {
		throw new Error(`Missing ${MS_AUTH_PRINCIPAL_CLAIMS_HEADER} header, cannot get authenticated user`)
	}
	return getPrincipalClaims(base64EncodedHeaderValue)
}
