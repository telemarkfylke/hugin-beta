import { describe, expect, it } from "vitest"
import { buildToolDescription, isUrlAllowed } from "../../../src/lib/server/website-tools/website-tool-client"
import type { WebsiteSourceEntry } from "../../../src/lib/types/website-source"

describe("isUrlAllowed", () => {
	it("allows an exact match", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/priser", matchType: "exact" }]
		expect(isUrlAllowed(new URL("https://example.no/priser"), entries)).toBe(true)
	})

	it("rejects a different path on an exact entry", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/priser", matchType: "exact" }]
		expect(isUrlAllowed(new URL("https://example.no/priser/2026"), entries)).toBe(false)
	})

	it("allows a page under a prefix entry", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/buss/", matchType: "prefix" }]
		expect(isUrlAllowed(new URL("https://example.no/buss/ruter/5"), entries)).toBe(true)
	})

	it("rejects a sibling path that merely starts with the same characters as the prefix", () => {
		// This is the exact bug a naive pathname.startsWith(prefix) check would have - "/bussinfo"
		// starts with the string "/buss" but is not under the "/buss/" section.
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/buss", matchType: "prefix" }]
		expect(isUrlAllowed(new URL("https://example.no/bussinfo"), entries)).toBe(false)
	})

	it("allows the prefix path itself, with or without a trailing slash", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/buss", matchType: "prefix" }]
		expect(isUrlAllowed(new URL("https://example.no/buss"), entries)).toBe(true)
		expect(isUrlAllowed(new URL("https://example.no/buss/"), entries)).toBe(true)
	})

	it("treats a bare-origin prefix as whole-domain access", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no", matchType: "prefix" }]
		expect(isUrlAllowed(new URL("https://example.no/hvor-som-helst"), entries)).toBe(true)
	})

	it("rejects a different host even if the path matches", () => {
		const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/buss/", matchType: "prefix" }]
		expect(isUrlAllowed(new URL("https://evil.no/buss/ruter/5"), entries)).toBe(false)
	})

	it("allows a match against any one of several entries", () => {
		const entries: WebsiteSourceEntry[] = [
			{ value: "https://example.no/priser", matchType: "exact" },
			{ value: "https://example.no/buss/", matchType: "prefix" }
		]
		expect(isUrlAllowed(new URL("https://example.no/buss/ruter/5"), entries)).toBe(true)
		expect(isUrlAllowed(new URL("https://example.no/priser"), entries)).toBe(true)
		expect(isUrlAllowed(new URL("https://example.no/annet"), entries)).toBe(false)
	})
})

describe("buildToolDescription", () => {
	it("lists both exact and prefix entries in the description", () => {
		const description = buildToolDescription([
			{ value: "https://example.no/priser", matchType: "exact" },
			{ value: "https://example.no/buss/", matchType: "prefix" }
		])
		expect(description).toContain("https://example.no/priser")
		expect(description).toContain("Alt under https://example.no/buss/")
	})
})
