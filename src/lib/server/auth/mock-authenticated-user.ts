// https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-user-identities

import { env } from "$env/dynamic/private"
import type { MSPrincipalClaim, MSPrincipalClaims } from "$lib/types/authentication"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "./auth-constants"

export const MOCK_AUTH = env.MOCK_AUTH === "true"
const MOCK_AUTH_ROLES = env.MOCK_AUTH_ROLES ? env.MOCK_AUTH_ROLES.split(",") : []
if (MOCK_AUTH) {
	if (MOCK_AUTH_ROLES.length === 0) {
		throw new Error("MOCK_AUTH is enabled but no MOCK_AUTH_ROLES are set. Please set MOCK_AUTH_ROLES to a comma-separated list of roles.")
	}
}

// Claims are based on a real authentication from this web app via EasyAuth / EntraID
// https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
const mockClaims: MSPrincipalClaims = {
	auth_typ: "aad",
	claims: [
		{
			typ: "aud",
			val: "guid-guid" // Audience - the client ID of the FRONTEND application
		},
		{
			typ: "iss",
			val: "https://login.microsoftonline.com/{tenantId}/v2.0" // Who issued the token / authentication
		},
		{
			typ: "iat",
			val: "1764835806" // Issued at - timestamp of when the token was issued
		},
		{
			typ: "nbf",
			val: "1764835806" // Not before - timestamp of when the token becomes valid
		},
		{
			typ: "exp",
			val: "1764839706" // Expiration - timestamp of when the token expires
		},
		{
			typ: "aio",
			val: "AcQAO/8aAAAA...." // An internal claim that's used to record data for token reuse. Should be ignored.
		},
		{
			typ: "c_hash",
			val: "Ajijifd..." // Used to validate the authenticity of an authorization code
		},
		{
			typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
			val: `demo.spokelse@fylke.no` // This value isn't guaranteed to be correct and is mutable over time. Never use it for authorization or to save data for a user.
		},
		{
			typ: "groups",
			val: "a23d4ddd-8e3a-40ca-b4ce-a32e87508094" // Group Object ID if groups are included in the token (in this case, only one group, random UUID genereated for mock)
		},
		{
			typ: "name",
			val: "Demo Spøkelse" // The name claim provides a human-readable value that identifies the subject of the token. The value isn't guaranteed to be unique, it can be changed, and should be used only for display purposes
		},
		{
			typ: "nonce",
			val: "4fd69fsdfdsf" // Nonce value to mitigate replay attacks (internal OAuth2 Entra stuff)
		},
		{
			typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
			val: "c0585101-3bd0-484b-9dad-a82dcbc6bd56" // The immutable identifier for an object, in this case, a random UUID genereated for mocking a user. This ID uniquely identifies the user across applications.
		},
		{
			typ: "preferred_username",
			val: `demo.spokelse@fylke.no` // The primary username that represents the user
		},
		{
			typ: "rh", // An internal claim used to revalidate tokens. Should be ignored.
			val: "dsfdsf..."
		},
		{
			typ: "sid",
			val: "guid" // Represents a unique identifier for a session and will be generated when a new session is established.
		},
		{
			typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
			val: "b-lM4...." // Dont know... bing it
		},
		{
			typ: "http://schemas.microsoft.com/identity/claims/tenantid",
			val: "guid" // Tenant ID - identifies the EntraID tenant
		},
		{
			typ: "uti",
			val: "CpU...." // Token identifier claim, equivalent to jti in the JWT specification. Unique, per-token identifier that is case-sensitive.
		},
		{
			typ: "ver",
			val: "2.0" // Indicates the version of the ID token.
		},
		...(MOCK_AUTH_ROLES.map((role) => ({
			typ: "roles",
			val: role
		})) as MSPrincipalClaim[])
	],
	name_typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
	role_typ: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
}
const base64MockClaims = Buffer.from(JSON.stringify(mockClaims), "utf-8").toString("base64")

export const injectMockAuthenticatedUserHeaders = (headers: Headers): Headers => {
	if (!MOCK_AUTH) {
		throw new Error("MOCK_AUTH is not enabled, you should not be calling this function!")
	}
	if (headers.has(MS_AUTH_PRINCIPAL_CLAIMS_HEADER)) {
		throw new Error(`Headers already have ${MS_AUTH_PRINCIPAL_CLAIMS_HEADER}, cannot inject mock authenticated user, when there is one there!`)
	}
	headers.set(MS_AUTH_PRINCIPAL_CLAIMS_HEADER, base64MockClaims)
	return headers
}
