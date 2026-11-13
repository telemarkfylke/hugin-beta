import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

const mockEnv: Record<string, string | undefined> = {}
vi.mock("$env/dynamic/private", () => ({ env: mockEnv }))
vi.mock("@vestfoldfylke/loglady", () => ({ logger: { warn: vi.fn(), error: vi.fn(), errorException: vi.fn() } }))

const principal = (userId = "user-1", groups: string[] = []): AuthenticatedPrincipal => ({ userId, name: "Test", preferredUserName: "test", affiliations: ["student"], huginRoles: [], groups })

type Reply = { ok: boolean; status?: number; json?: unknown }
type Replies = { token?: Reply; graph?: Reply }

const TOKEN_REPLY: Reply = { ok: true, json: { access_token: "app-token", expires_in: 3600 } }

/** Routes fetch by URL: the token endpoint and Graph's checkMemberGroups. Returns the mock so calls can be inspected. */
const stubFetch = ({ token = TOKEN_REPLY, graph = { ok: true, json: { value: [] } } }: Replies = {}) => {
	const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
		const reply = url.includes("login.microsoftonline.com") ? token : graph
		return { ok: reply.ok, status: reply.status ?? 200, json: async () => reply.json }
	})
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

const callsTo = (fetchMock: ReturnType<typeof stubFetch>, part: string) => fetchMock.mock.calls.filter(([url]) => url.includes(part))

// Fresh module for every test, so the user cache and the cached app token don't leak between tests
const load = async () => (await import("../../../src/lib/server/auth/blocked-groups")).isUserInBlockedGroup

beforeEach(() => {
	vi.resetModules()
	mockEnv.BLOCKED_GROUPS = "Group-A, group-b"
	mockEnv.ENTRA_TENANT_ID = "tenant-1"
	mockEnv.ENTRA_CLIENT_ID = "client-1"
	mockEnv.ENTRA_CLIENT_SECRET = "secret-1"
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("isUserInBlockedGroup", () => {
	it("does nothing when BLOCKED_GROUPS is empty", async () => {
		mockEnv.BLOCKED_GROUPS = ""
		const fetchMock = stubFetch()
		expect(await (await load())(principal("u", ["group-a"]))).toBe(false)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("blocks on the groups claim (case-insensitive) without calling Graph", async () => {
		const fetchMock = stubFetch()
		expect(await (await load())(principal("u", ["GROUP-A"]))).toBe(true)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("blocks when Graph says the user is a member, using the app's own token", async () => {
		const fetchMock = stubFetch({ graph: { ok: true, json: { value: ["group-b"] } } })
		expect(await (await load())(principal("user/1"))).toBe(true)

		const tokenInit = callsTo(fetchMock, "login.microsoftonline.com")[0]?.[1]
		expect(Object.fromEntries(tokenInit?.body as URLSearchParams)).toEqual({
			grant_type: "client_credentials",
			client_id: "client-1",
			client_secret: "secret-1",
			scope: "https://graph.microsoft.com/.default"
		})

		const [graphUrl, graphInit] = callsTo(fetchMock, "graph.microsoft.com")[0] ?? []
		expect(graphUrl).toBe("https://graph.microsoft.com/v1.0/users/user%2F1/checkMemberGroups")
		expect((graphInit?.headers as Record<string, string>).authorization).toBe("Bearer app-token")
		expect(JSON.parse(graphInit?.body as string)).toEqual({ groupIds: ["group-a", "group-b"] })
	})

	it("lets the user through when Graph says no membership", async () => {
		stubFetch({ graph: { ok: true, json: { value: [] } } })
		expect(await (await load())(principal())).toBe(false)
	})

	it("fails open on a Graph error and does not cache the failure", async () => {
		const fetchMock = stubFetch({ graph: { ok: false, status: 403 } })
		const check = await load()
		expect(await check(principal("u"))).toBe(false)
		expect(callsTo(fetchMock, "graph.microsoft.com")).toHaveLength(1)

		stubFetch({ graph: { ok: true, json: { value: ["group-a"] } } })
		expect(await check(principal("u"))).toBe(true)
	})

	it("fails open when the app token can't be fetched", async () => {
		const fetchMock = stubFetch({ token: { ok: false, status: 401 } })
		expect(await (await load())(principal())).toBe(false)
		expect(callsTo(fetchMock, "graph.microsoft.com")).toHaveLength(0)
	})

	it("caches the result per user", async () => {
		const fetchMock = stubFetch({ graph: { ok: true, json: { value: ["group-a"] } } })
		const check = await load()
		expect(await check(principal("u"))).toBe(true)
		expect(await check(principal("u"))).toBe(true)
		expect(callsTo(fetchMock, "graph.microsoft.com")).toHaveLength(1)
	})

	it("reuses the app token across users", async () => {
		const fetchMock = stubFetch()
		const check = await load()
		await check(principal("u1"))
		await check(principal("u2"))
		expect(callsTo(fetchMock, "login.microsoftonline.com")).toHaveLength(1)
		expect(callsTo(fetchMock, "graph.microsoft.com")).toHaveLength(2)
	})
})
