import { describe, expect, it } from "vitest"
import { configHasMcpTool } from "../../../src/lib/server/mcp/run-mcp-chat"
import type { ChatConfig } from "../../../src/lib/types/chat"

const base = {
	_id: "1",
	name: "n",
	description: "",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4o",
	type: "private",
	accessGroups: ["all"],
	created: { at: "", by: { id: "" } },
	updated: { at: "", by: { id: "" } }
} as unknown as ChatConfig

describe("configHasMcpTool", () => {
	it("is true when an mcp tool is present", () => {
		expect(configHasMcpTool({ ...base, tools: [{ type: "mcp", server: "sharepoint" }] })).toBe(true)
	})
	it("is false for web_search only", () => {
		expect(configHasMcpTool({ ...base, tools: [{ type: "web_search" }] })).toBe(false)
	})
	it("is false when tools is undefined", () => {
		expect(configHasMcpTool(base)).toBe(false)
	})
})
