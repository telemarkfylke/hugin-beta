import { describe, expect, it } from "vitest"
import { getAuthenticatedPrincipal, getPrincipalClaims } from "$lib/server/auth/get-authenticated-user"
import type { MSPrincipalClaims } from "$lib/types/authentication"

const encodeClaims = (claims: unknown): string => Buffer.from(JSON.stringify(claims), "utf-8").toString("base64")

const validClaims: MSPrincipalClaims = {
	auth_typ: "aad",
	claims: [
		{ typ: "http://schemas.microsoft.com/identity/claims/objectidentifier", val: "user-id-1" },
		{ typ: "preferred_username", val: "user@example.com" },
		{ typ: "name", val: "Test User" },
		{ typ: "roles", val: "Employee" },
		{ typ: "groups", val: "group-1" }
	],
	name_typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
	role_typ: "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
}

describe("getPrincipalClaims", () => {
	it("parses valid EasyAuth principal claims", () => {
		expect(getPrincipalClaims(encodeClaims(validClaims))).toEqual(validClaims)
	})

	it("rejects invalid JSON", () => {
		expect(() => getPrincipalClaims(Buffer.from("not-json", "utf-8").toString("base64"))).toThrow("Failed to JSON.parse")
	})

	it("rejects missing required metadata", () => {
		expect(() => getPrincipalClaims(encodeClaims({ claims: [] }))).toThrow("missing required property")
	})

	it("rejects malformed individual claims", () => {
		expect(() => getPrincipalClaims(encodeClaims({ ...validClaims, claims: [{ typ: "name" }] }))).toThrow("Principal claim val must be a string")
	})
})

describe("getAuthenticatedPrincipal", () => {
	it("extracts authenticated user identity, roles and groups", () => {
		const headers = new Headers({ "x-ms-client-principal": encodeClaims(validClaims) })

		expect(getAuthenticatedPrincipal(headers)).toEqual({
			userId: "user-id-1",
			preferredUserName: "user@example.com",
			name: "Test User",
			roles: ["Employee"],
			groups: ["group-1"]
		})
	})

	it("rejects principals without roles", () => {
		const claimsWithoutRoles: MSPrincipalClaims = {
			...validClaims,
			claims: validClaims.claims.filter((claim) => claim.typ !== "roles")
		}
		const headers = new Headers({ "x-ms-client-principal": encodeClaims(claimsWithoutRoles) })

		expect(() => getAuthenticatedPrincipal(headers)).toThrow("No roles found")
	})
})
