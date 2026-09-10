import { describe, expect, it } from "vitest"
import { configHasMcpTool, mcpUnavailableStream } from "../../../src/lib/server/mcp/run-mcp-chat"
import type { ChatConfig } from "../../../src/lib/types/chat"

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
		expect(configHasMcpTool({ ...base, tools: [{ type: "mcp" }] })).toBe(true)
	})
	it("is false for web_search only", () => {
		expect(configHasMcpTool({ ...base, tools: [{ type: "web_search" }] })).toBe(false)
	})
	it("is false when tools is undefined", () => {
		expect(configHasMcpTool(base)).toBe(false)
	})
})

describe("mcpUnavailableStream", () => {
	it("emits a single user-facing response.error event and closes, with a default SharePoint-flavored message", async () => {
		const events = await collectEvents(mcpUnavailableStream())
		expect(events).toHaveLength(1)
		expect(events[0]?.event).toBe("response.error")
		expect(events[0]?.data.code).toBe("mcp_unavailable")
		expect(events[0]?.data.message).toMatch(/SharePoint/i)
	})

	it("uses a custom message when given one (e.g. for the website tool-calling path)", async () => {
		const events = await collectEvents(mcpUnavailableStream("Noe annet gikk galt"))
		expect(events[0]?.data.message).toBe("Noe annet gikk galt")
	})
})
