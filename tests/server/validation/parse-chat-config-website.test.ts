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

describe("parseChatConfig with website datasource", () => {
	it("accepts a website datasource on its own", () => {
		const config = parseChatConfig({ ...base, model: "gpt-4o", dataSources: [{ type: "website", id: "web-1" }] }, APP_CONFIG)
		expect(config.dataSources).toEqual([{ type: "website", id: "web-1" }])
	})

	it("accepts a website datasource combined with a ragservice datasource", () => {
		const config = parseChatConfig(
			{
				...base,
				model: "gpt-4o",
				dataSources: [
					{ type: "ragservice", id: "store-1" },
					{ type: "website", id: "web-1" }
				]
			},
			APP_CONFIG
		)
		expect(config.dataSources).toEqual([
			{ type: "ragservice", id: "store-1" },
			{ type: "website", id: "web-1" }
		])
	})

	it("rejects a website datasource on a predefined vendor-agent config (same reasoning as mcp)", () => {
		expect(() => parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, dataSources: [{ type: "website", id: "web-1" }] }, APP_CONFIG)).toThrow(HTTPError)
	})
})
