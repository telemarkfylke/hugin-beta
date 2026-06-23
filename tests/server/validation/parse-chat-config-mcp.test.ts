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
	it("accepts an mcp tool on a manual config", () => {
		const config = parseChatConfig({ ...base, model: "gpt-4o", tools: [{ type: "mcp", server: "sharepoint" }] }, APP_CONFIG)
		expect(config.tools).toEqual([{ type: "mcp", server: "sharepoint" }])
	})

	it("rejects an mcp tool on a predefined vendor-agent config", () => {
		expect(() => parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, tools: [{ type: "mcp", server: "sharepoint" }] }, APP_CONFIG)).toThrow(HTTPError)
	})
})
