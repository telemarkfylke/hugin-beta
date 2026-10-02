import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const lookupMock = vi.hoisted(() => vi.fn())
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }))

import { assertPublicHost, buildToolDescription, createWebsiteToolClient, isBlockedAddress, isUrlAllowed } from "../../../src/lib/server/website-tools/website-tool-client"
import type { WebsiteSourceEntry } from "../../../src/lib/types/website-source"

describe("isBlockedAddress", () => {
	it.each([
		"127.0.0.1",
		"10.1.2.3",
		"172.16.0.1",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"0.0.0.0",
		"::1",
		"::",
		"fd00::1",
		"fe80::1",
		"::ffff:127.0.0.1",
		"not-an-ip"
	])("blocks %s", (address) => {
		expect(isBlockedAddress(address)).toBe(true)
	})

	it.each(["8.8.8.8", "185.15.59.224", "2a00:1450:4001:80b::200e"])("allows public %s", (address) => {
		expect(isBlockedAddress(address)).toBe(false)
	})
})

describe("assertPublicHost", () => {
	afterEach(() => lookupMock.mockReset())

	it("rejects an IP literal pointing at the metadata endpoint without a DNS lookup", async () => {
		await expect(assertPublicHost(new URL("http://169.254.169.254/latest"))).rejects.toThrow("intern adresse")
		expect(lookupMock).not.toHaveBeenCalled()
	})

	it("rejects a bracketed IPv6 loopback literal", async () => {
		await expect(assertPublicHost(new URL("http://[::1]/"))).rejects.toThrow("intern adresse")
	})

	it("rejects a hostname where any resolved address is internal", async () => {
		lookupMock.mockResolvedValue([
			{ address: "93.184.216.34", family: 4 },
			{ address: "10.0.0.5", family: 4 }
		])
		await expect(assertPublicHost(new URL("https://intranett.example.no/"))).rejects.toThrow("intern adresse")
	})

	it("accepts a hostname resolving only to public addresses", async () => {
		lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
		await expect(assertPublicHost(new URL("https://example.no/"))).resolves.toBeUndefined()
	})
})

describe("browse_website redirects", () => {
	const entries: WebsiteSourceEntry[] = [{ value: "https://example.no/", matchType: "prefix" }]
	const fetchMock = vi.fn()

	beforeEach(() => {
		lookupMock.mockImplementation(async (hostname: string) => [{ address: hostname === "internal.example.no" ? "10.0.0.5" : "93.184.216.34", family: 4 }])
		vi.stubGlobal("fetch", fetchMock)
	})
	afterEach(() => {
		lookupMock.mockReset()
		fetchMock.mockReset()
		vi.unstubAllGlobals()
	})

	const redirectTo = (location: string) => new Response(null, { status: 302, headers: { location } })
	const page = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } })

	it("does not let fetch follow redirects on its own", async () => {
		fetchMock.mockResolvedValueOnce(page("<p>Hei</p>"))
		await createWebsiteToolClient(entries).callTool("browse_website", { url: "https://example.no/a" })
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" })
	})

	it("follows a redirect that stays inside the allow-list", async () => {
		fetchMock.mockResolvedValueOnce(redirectTo("/b")).mockResolvedValueOnce(page("<p>Side B</p>"))
		const result = await createWebsiteToolClient(entries).callTool("browse_website", { url: "https://example.no/a" })
		expect(result).toContain("Side B")
		expect(String(fetchMock.mock.calls[1]?.[0])).toBe("https://example.no/b")
	})

	it("refuses a redirect to a host outside the allow-list", async () => {
		fetchMock.mockResolvedValueOnce(redirectTo("https://evil.example.com/"))
		await expect(createWebsiteToolClient(entries).callTool("browse_website", { url: "https://example.no/a" })).rejects.toThrow("ikke blant sidene")
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it("refuses a redirect to an internal address", async () => {
		const wide: WebsiteSourceEntry[] = [...entries, { value: "http://169.254.169.254/", matchType: "prefix" }]
		fetchMock.mockResolvedValueOnce(redirectTo("http://169.254.169.254/metadata"))
		await expect(createWebsiteToolClient(wide).callTool("browse_website", { url: "https://example.no/a" })).rejects.toThrow("intern adresse")
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it("refuses an allow-listed host that resolves to an internal address", async () => {
		const internal: WebsiteSourceEntry[] = [{ value: "https://internal.example.no/", matchType: "prefix" }]
		await expect(createWebsiteToolClient(internal).callTool("browse_website", { url: "https://internal.example.no/" })).rejects.toThrow("intern adresse")
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("gives up after too many redirects", async () => {
		fetchMock.mockImplementation(async () => redirectTo("/loop"))
		await expect(createWebsiteToolClient(entries).callTool("browse_website", { url: "https://example.no/a" })).rejects.toThrow("for mange ganger")
	})
})

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
