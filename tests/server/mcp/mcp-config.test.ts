import { afterEach, describe, expect, it, vi } from "vitest"

const ENV = {
	MCP_SHAREPOINT_ENABLED: "true",
	MCP_SHAREPOINT_URL: "https://mcp.example/mcp",
	MCP_SHAREPOINT_CLIENT_ID: "client-id",
	MCP_SHAREPOINT_CLIENT_SECRET: "secret",
	MCP_SHAREPOINT_TENANT_ID: "tenant",
	MCP_SHAREPOINT_SCOPE: "api://x/.default"
}

const loadWithEnv = async (overrides: Record<string, string | undefined>) => {
	vi.resetModules()
	vi.doMock("$env/dynamic/private", () => ({ env: { ...ENV, ...overrides } }))
	return await import("../../../src/lib/server/mcp/mcp-config")
}

afterEach(() => {
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
})

describe("getMcpConfig", () => {
	it("returns a full config when enabled and all vars present", async () => {
		const { getMcpConfig } = await loadWithEnv({})
		expect(getMcpConfig()).toEqual({
			url: "https://mcp.example/mcp",
			clientId: "client-id",
			clientSecret: "secret",
			tenantId: "tenant",
			scope: "api://x/.default"
		})
	})

	it("returns null when disabled", async () => {
		const { getMcpConfig } = await loadWithEnv({ MCP_SHAREPOINT_ENABLED: "false" })
		expect(getMcpConfig()).toBeNull()
	})

	it("returns null when a required var is missing", async () => {
		const { getMcpConfig } = await loadWithEnv({ MCP_SHAREPOINT_CLIENT_SECRET: undefined })
		expect(getMcpConfig()).toBeNull()
	})
})
