import { describe, expect, it, vi } from "vitest"
import { configHasMcpTool, mcpUnavailableStream } from "../../../src/lib/server/mcp/run-mcp-chat"
import type { ChatConfig, ChatRequest } from "../../../src/lib/types/chat"

const collectEvents = async (stream: ReadableStream<Uint8Array>): Promise<{ event: string; data: { code: string; message: string } }[]> => {
	const reader = stream.getReader()
	const decoder = new TextDecoder()
	let buffer = ""
	for (;;) {
		const { value, done } = await reader.read()
		if (value) buffer += decoder.decode(value, { stream: true })
		if (done) break
	}
	return buffer
		.split("\n\n")
		.filter((block) => block.length > 0)
		.map((block) => {
			const [eventLine, dataLine] = block.split("\n")
			return { event: (eventLine ?? "").slice(7), data: JSON.parse((dataLine ?? "").slice(6)) }
		})
}

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

describe("mcpUnavailableStream", () => {
	it("emits a single user-facing response.error event and closes", async () => {
		const events = await collectEvents(mcpUnavailableStream())
		expect(events).toHaveLength(1)
		expect(events[0]?.event).toBe("response.error")
		expect(events[0]?.data.code).toBe("mcp_unavailable")
		expect(events[0]?.data.message).toMatch(/SharePoint/i)
	})
})

describe("runMcpChat graceful degradation", () => {
	it("returns a response.error stream instead of throwing when MCP is not configured", async () => {
		vi.resetModules()
		vi.doMock("../../../src/lib/server/mcp/mcp-client", () => ({ getSharepointMcpClient: async () => null }))
		const { runMcpChat } = await import("../../../src/lib/server/mcp/run-mcp-chat")
		const chatRequest = { config: { ...base, tools: [{ type: "mcp", server: "sharepoint" }] }, inputs: [], stream: true } as unknown as ChatRequest

		const stream = await runMcpChat(chatRequest)
		const events = await collectEvents(stream)

		expect(events.some((e) => e.event === "response.error")).toBe(true)
		expect(events.find((e) => e.event === "response.error")?.data.message).toMatch(/SharePoint/i)
		vi.doUnmock("../../../src/lib/server/mcp/mcp-client")
	})
})
