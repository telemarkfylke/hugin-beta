// https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities

import { env } from "$env/dynamic/private"
import type { MSPrincipalClaims } from "$lib/types/authentication"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "./auth-constants"

export const MOCK_AUTH = env.MOCK_AUTH === "true"
const MOCK_AUTH_ROLES = env.MOCK_AUTH_ROLES ? env.MOCK_AUTH_ROLES.split(",") : []
if (MOCK_AUTH) {
	if (MOCK_AUTH_ROLES.length === 0) {
		throw new Error("MOCK_AUTH is enabled but no MOCK_AUTH_ROLES are set. Please set MOCK_AUTH_ROLES to a comma-separated list of roles.")
	}
}

const _mockClaims: MSPrincipalClaims = {
	auth_typ: "aad",
	claims: [
		{
			typ: "aud",
			val: "guid-guid" // Audience - the client ID of the application?
		},
		{
			typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
			val: `demo.spokelse@fylke.no` // User's email address
		},
		{
			typ: "name",
			val: "Demo Spøkelse" // User's full name?
		},
		{
			typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
			val: "12345-4378493-fjdiofjd" // Object ID - unique identifier for the user?
		},
		{
			typ: "preferred_username",
			val: `demo.spokelse@fylke.no` // Preferred username??
		},
		...MOCK_AUTH_ROLES.map((role) => ({
			typ: "roles",
			val: role
		}))
	],
	name_typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
	role_typ: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
}
const _base64MockClaims = Buffer.from(JSON.stringify(_mockClaims), "utf-8").toString("base64")

export const injectMockAuthenticatedUserHeaders = (headers: Headers): Headers => {
	if (!MOCK_AUTH) {
		throw new Error("MOCK_AUTH is not enabled, you should not be calling this function!")
	}
	if (headers.has(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)) {
		throw new Error(`Headers already have ${MS_AUTH_PRINCIPAL_CLAIMS_HEADER}, cannot inject mock authenticated user, when there is one there!`)
	}
	headers.set(MS_AUTH_PRINCIPAL_CLAIMS_HEADER, _base64MockClaims)
	return headers
}
