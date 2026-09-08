import { afterEach, describe, expect, it, vi } from "vitest"

const loadWithEnv = async (overrides: Record<string, string | undefined>) => {
	vi.resetModules()
	vi.doMock("$env/dynamic/private", () => ({
		env: {
			MOCK_DB: "true",
			APP_ROLE_EMPLOYEE: "Employee",
			APP_ROLE_STUDENT: "Student",
			APP_ROLE_ADMIN: "Admin",
			APP_ROLE_AGENT_MAINTAINER: "AgentMaintainer",
			...overrides
		}
	}))
	return await import("../../src/lib/server/app-config/app-config")
}

afterEach(() => {
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
})

describe("APP_CONFIG.MCP_SHAREPOINT_ENABLED", () => {
	it("is false when MCP is not configured", async () => {
		const { APP_CONFIG } = await loadWithEnv({})
		expect(APP_CONFIG.MCP_SHAREPOINT_ENABLED).toBe(false)
	})

	it("is true when MCP is fully configured", async () => {
		const { APP_CONFIG } = await loadWithEnv({
			MCP_SHAREPOINT_ENABLED: "true",
			MCP_SHAREPOINT_URL: "https://mcp.example/mcp",
			MCP_SHAREPOINT_CLIENT_ID: "id",
			MCP_SHAREPOINT_CLIENT_SECRET: "secret",
			MCP_SHAREPOINT_TENANT_ID: "tenant",
			MCP_SHAREPOINT_SCOPE: "scope"
		})
		expect(APP_CONFIG.MCP_SHAREPOINT_ENABLED).toBe(true)
	})

	it("is false when the enabled flag is set but a required var is missing", async () => {
		const { APP_CONFIG } = await loadWithEnv({ MCP_SHAREPOINT_ENABLED: "true", MCP_SHAREPOINT_URL: "https://mcp.example/mcp" })
		expect(APP_CONFIG.MCP_SHAREPOINT_ENABLED).toBe(false)
	})
})
