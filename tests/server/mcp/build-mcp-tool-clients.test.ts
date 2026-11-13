import { afterEach, describe, expect, it, vi } from "vitest"

const getSharepointMcpClient = vi.fn()

vi.mock("../../../src/lib/server/mcp/mcp-client", () => ({ getSharepointMcpClient }))

const { buildMcpToolClients } = await import("../../../src/lib/server/mcp/build-mcp-tool-clients")

afterEach(() => vi.clearAllMocks())

const sharepointSource = { server: "sharepoint", folders: ["/a"], searchEnabled: false, lists: [] } as never

describe("buildMcpToolClients", () => {
	it("reports unavailable (instead of throwing) when connecting to the MCP server fails", async () => {
		getSharepointMcpClient.mockRejectedValue(new TypeError("fetch failed"))

		const result = await buildMcpToolClients([sharepointSource])

		expect(result).toEqual({ clients: [], unavailable: true })
	})

	it("reports unavailable when MCP is not configured (null client)", async () => {
		getSharepointMcpClient.mockResolvedValue(null)

		const result = await buildMcpToolClients([sharepointSource])

		expect(result.unavailable).toBe(true)
	})
})
