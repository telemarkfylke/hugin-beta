import { describe, expect, it } from "vitest"
import { HTTPError } from "../../../src/lib/server/middleware/http-error"
import type { AppConfig } from "../../../src/lib/types/app-config"
import { parseChatConfig } from "../../../src/lib/validation/parse-chat-config"

const APP_CONFIG = {
	VENDORS: {
		OPENAI: { NAME: "OpenAI", ENABLED: true, PROJECTS: ["DEFAULT"], MODELS: [{ ID: "gpt-4o", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: [], IMAGE: [] } }] }
	}
} as unknown as AppConfig

const base = {
	_id: "1",
	name: "n",
	description: "d",
	vendorId: "OPENAI",
	project: "DEFAULT",
	type: "private",
	accessGroups: ["all"],
	created: { at: "now", by: { id: "u" } },
	updated: { at: "now", by: { id: "u" } }
}

describe("parseChatConfig with MCP tool", () => {
	it("accepts an mcp tool + mcp datasource on a manual config", () => {
		const config = parseChatConfig({ ...base, model: "gpt-4o", tools: [{ type: "mcp" }], dataSources: [{ type: "mcp", sourceId: "mcp-1" }] }, APP_CONFIG)
		expect(config.tools).toEqual([{ type: "mcp" }])
		expect(config.dataSources).toEqual([{ type: "mcp", sourceId: "mcp-1" }])
	})

	it("accepts an mcp datasource combined with a ragservice datasource", () => {
		const config = parseChatConfig(
			{
				...base,
				model: "gpt-4o",
				dataSources: [
					{ type: "ragservice", id: "store-1" },
					{ type: "mcp", sourceId: "mcp-1" }
				]
			},
			APP_CONFIG
		)
		expect(config.dataSources).toEqual([
			{ type: "ragservice", id: "store-1" },
			{ type: "mcp", sourceId: "mcp-1" }
		])
	})

	it("accepts multiple mcp datasources at once", () => {
		const config = parseChatConfig(
			{
				...base,
				model: "gpt-4o",
				dataSources: [
					{ type: "mcp", sourceId: "mcp-1" },
					{ type: "mcp", sourceId: "mcp-2" }
				]
			},
			APP_CONFIG
		)
		expect(config.dataSources).toEqual([
			{ type: "mcp", sourceId: "mcp-1" },
			{ type: "mcp", sourceId: "mcp-2" }
		])
	})

	it("rejects an mcp tool on a predefined vendor-agent config", () => {
		expect(() => parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, tools: [{ type: "mcp" }] }, APP_CONFIG)).toThrow(HTTPError)
	})

	it("rejects an mcp datasource on a predefined vendor-agent config", () => {
		expect(() => parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, dataSources: [{ type: "mcp", sourceId: "mcp-1" }] }, APP_CONFIG)).toThrow(HTTPError)
	})
})
