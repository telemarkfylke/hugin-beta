import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTokenProvider } from "../../../src/lib/server/mcp/mcp-token"

const config = {
	url: "https://mcp.example/mcp",
	clientId: "client-id",
	clientSecret: "secret",
	tenantId: "tenant",
	scope: "api://x/.default"
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date("2026-06-23T00:00:00Z"))
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe("createTokenProvider", () => {
	it("fetches a token and caches it within its lifetime", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600, token_type: "Bearer" }), { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)
		const getToken = createTokenProvider(config)

		expect(await getToken()).toBe("tok-1")
		expect(await getToken()).toBe("tok-1")
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it("refetches after expiry", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600, token_type: "Bearer" }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "tok-2", expires_in: 3600, token_type: "Bearer" }), { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)
		const getToken = createTokenProvider(config)

		expect(await getToken()).toBe("tok-1")
		vi.advanceTimersByTime(3600 * 1000)
		expect(await getToken()).toBe("tok-2")
		expect(fetchMock).toHaveBeenCalledTimes(2)
	})

	it("throws a descriptive error on non-OK token response", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }))
		vi.stubGlobal("fetch", fetchMock)
		const getToken = createTokenProvider(config)
		await expect(getToken()).rejects.toThrow(/token request failed/i)
	})
})
