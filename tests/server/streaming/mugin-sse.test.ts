import { describe, expect, it } from "vitest"
import { MuginSse } from "../../../src/lib/types/streaming"

describe("MuginSse tool events", () => {
	it("parses response.tool_call", () => {
		const parsed = MuginSse.parse({ event: "response.tool_call", data: { itemId: "call_1", toolName: "Search_SharePoint" } })
		expect(parsed.event).toBe("response.tool_call")
	})

	it("parses response.tool_result with ok status", () => {
		const parsed = MuginSse.parse({ event: "response.tool_result", data: { itemId: "call_1", toolName: "Search_SharePoint", status: "ok" } })
		expect(parsed.event).toBe("response.tool_result")
	})

	it("rejects an invalid tool_result status", () => {
		expect(() => MuginSse.parse({ event: "response.tool_result", data: { itemId: "x", toolName: "y", status: "maybe" } })).toThrow()
	})
})
