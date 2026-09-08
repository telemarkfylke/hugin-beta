import { afterEach, describe, expect, it, vi } from "vitest"

const mockMcpConfig = { url: "http://example.com/mcp", clientId: "id", clientSecret: "secret", tenantId: "tenant", scope: "scope" }

vi.mock("../../../src/lib/server/mcp/mcp-config", () => ({
	getMcpConfig: () => mockMcpConfig
}))

vi.mock("../../../src/lib/server/mcp/mcp-token", () => ({
	createTokenProvider: () => async () => "fake-token"
}))

// Each `new Client(...)` call pushes a fresh, individually-mockable SDK client instance here, so a
// test can tell which underlying SDK client backed a given call, and assert on construction count
// to prove (or disprove) that mcp-client.ts reconnected.
const sdkClientInstances: Array<{ connect: ReturnType<typeof vi.fn>; listTools: ReturnType<typeof vi.fn>; callTool: ReturnType<typeof vi.fn> }> = []

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn().mockImplementation(function Client() {
		const instance = {
			connect: vi.fn().mockResolvedValue(undefined),
			listTools: vi.fn().mockResolvedValue({ tools: [] }),
			callTool: vi.fn().mockResolvedValue({ isError: false, content: [] })
		}
		sdkClientInstances.push(instance)
		return instance
	})
}))

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
	StreamableHTTPClientTransport: vi.fn().mockImplementation(function StreamableHTTPClientTransport() {
		return {}
	})
}))

const { flattenToolResult, getSharepointMcpClient } = await import("../../../src/lib/server/mcp/mcp-client")
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")

// clearAllMocks only wipes call history, not the mockImplementation() the vi.mock factories above
// set up for Client/StreamableHTTPClientTransport - restoreAllMocks would strip those
// implementations entirely (since these aren't vi.spyOn spies, "restore" degrades to a full
// mockReset that also drops the implementation), breaking every test after the first.
afterEach(() => vi.clearAllMocks())

describe("flattenToolResult", () => {
	it("concatenates text content parts", () => {
		expect(
			flattenToolResult({
				content: [
					{ type: "text", text: "a" },
					{ type: "text", text: "b" }
				]
			})
		).toBe("ab")
	})

	it("ignores non-text parts", () => {
		expect(
			flattenToolResult({
				content: [
					{ type: "image", data: "x" },
					{ type: "text", text: "only" }
				]
			})
		).toBe("only")
	})

	it("returns empty string when no content", () => {
		expect(flattenToolResult({})).toBe("")
	})
})

describe("getSharepointMcpClient reconnection", () => {
	// One continuous scenario (rather than separate `it`s) because mcp-client.ts caches its client
	// behind a module-level singleton promise - each getSharepointMcpClient() call in this test
	// observes the state left by the previous step, which is exactly the behaviour under test.
	it("reconnects after a transport-level SDK failure, but reuses the client after a tool-level isError", async () => {
		// First call connects and constructs one SDK client.
		const client1 = await getSharepointMcpClient()
		expect(client1).not.toBeNull()
		expect(Client).toHaveBeenCalledTimes(1)
		const sdkClient1 = sdkClientInstances[0]
		if (!sdkClient1) throw new Error("expected sdk client instance to have been constructed")

		// listTools failing at the SDK level (dead transport) must invalidate the cached client.
		sdkClient1.listTools.mockRejectedValueOnce(new Error("transport dead"))
		await expect(client1?.listTools()).rejects.toThrow("transport dead")

		const client2 = await getSharepointMcpClient()
		expect(Client).toHaveBeenCalledTimes(2)
		expect(client2).not.toBe(client1)
		const sdkClient2 = sdkClientInstances[1]
		if (!sdkClient2) throw new Error("expected a second sdk client instance to have been constructed")

		// A legitimate MCP-level tool failure (isError: true, SDK call itself succeeded) must NOT
		// invalidate the client - this is by-design behaviour from an earlier task, not a transport problem.
		sdkClient2.callTool.mockResolvedValueOnce({ isError: true, content: [{ type: "text", text: "list not found" }] })
		await expect(client2?.callTool("Search_SharePoint", {})).rejects.toThrow("list not found")

		const client3 = await getSharepointMcpClient()
		expect(Client).toHaveBeenCalledTimes(2)
		expect(client3).toBe(client2)

		// callTool failing at the SDK level (transport-level, before any result/isError exists) must
		// invalidate the cached client too.
		sdkClient2.callTool.mockRejectedValueOnce(new Error("socket hang up"))
		await expect(client3?.callTool("Search_SharePoint", {})).rejects.toThrow("socket hang up")

		const client4 = await getSharepointMcpClient()
		expect(Client).toHaveBeenCalledTimes(3)
		expect(client4).not.toBe(client3)
	})
})
