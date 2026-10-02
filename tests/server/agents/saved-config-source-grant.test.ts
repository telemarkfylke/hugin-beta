import { describe, expect, it } from "vitest"
import { sourceGrantFromSavedConfig } from "$lib/server/agents/saved-config-source-grant"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

const savedConfig: ChatConfig = {
	_id: "cfg-1",
	name: "n",
	description: "d",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4o",
	type: "published",
	accessGroups: ["employee"],
	dataSources: [
		{ type: "website", id: "web-1" },
		{ type: "mcp", sourceId: "mcp-1" },
		{ type: "ragservice", id: "rag-1" }
	],
	created: { at: "now", by: { id: "owner" } },
	updated: { at: "now", by: { id: "owner" } }
}

const employee: AuthenticatedPrincipal = { userId: "u1", name: "U", preferredUserName: "u", roles: [APP_CONFIG.APP_ROLES.EMPLOYEE], groups: [] }
const student: AuthenticatedPrincipal = { userId: "s1", name: "S", preferredUserName: "s", roles: [APP_CONFIG.APP_ROLES.STUDENT], groups: [] }

describe("sourceGrantFromSavedConfig", () => {
	it("grants the sources the saved assistant references to a user who may prompt it", () => {
		const grant = sourceGrantFromSavedConfig(savedConfig, employee, APP_CONFIG)
		expect(grant("website", "web-1")).toBe(true)
		expect(grant("mcp", "mcp-1")).toBe(true)
	})

	it("does not grant sources the saved assistant doesn't reference", () => {
		const grant = sourceGrantFromSavedConfig(savedConfig, employee, APP_CONFIG)
		expect(grant("website", "someone-elses-source")).toBe(false)
		expect(grant("mcp", "web-1")).toBe(false)
	})

	it("grants nothing when the user may not prompt the saved assistant", () => {
		const grant = sourceGrantFromSavedConfig(savedConfig, student, APP_CONFIG)
		expect(grant("website", "web-1")).toBe(false)
		expect(grant("mcp", "mcp-1")).toBe(false)
	})

	it("grants nothing for an unsaved config", () => {
		const grant = sourceGrantFromSavedConfig(null, employee, APP_CONFIG)
		expect(grant("website", "web-1")).toBe(false)
	})
})
