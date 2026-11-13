import { afterEach, describe, expect, it, vi } from "vitest"

const getSharepointMcpClient = vi.fn()

vi.mock("../../../src/lib/server/mcp/mcp-client", () => ({ getSharepointMcpClient }))

const { callSharepointAdminTool } = await import("../../../src/lib/server/mcp/call-sharepoint-admin-tool")
const { HTTPError } = await import("../../../src/lib/server/middleware/http-error")

afterEach(() => vi.clearAllMocks())

describe("callSharepointAdminTool", () => {
	it("returns the tool text on success", async () => {
		getSharepointMcpClient.mockResolvedValue({ callTool: vi.fn().mockResolvedValue("ok") })
		expect(await callSharepointAdminTool("List_SharePoint_Lists", {})).toBe("ok")
	})

	it("throws HTTPError 503 when MCP is not configured", async () => {
		getSharepointMcpClient.mockResolvedValue(null)
		await expect(callSharepointAdminTool("X", {})).rejects.toMatchObject({ status: 503 })
	})

	it("throws a readable HTTPError 502 when connecting fails", async () => {
		getSharepointMcpClient.mockRejectedValue(new TypeError("fetch failed"))
		const error = await callSharepointAdminTool("X", {}).catch((e) => e)
		expect(error).toBeInstanceOf(HTTPError)
		expect(error.status).toBe(502)
		expect(error.message).toBe("Could not reach the SharePoint service")
	})

	it("throws a readable HTTPError 502 when the tool call fails", async () => {
		getSharepointMcpClient.mockResolvedValue({ callTool: vi.fn().mockRejectedValue(new Error("boom")) })
		await expect(callSharepointAdminTool("X", {})).rejects.toMatchObject({ status: 502 })
	})
})
