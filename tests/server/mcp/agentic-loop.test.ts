import { describe, expect, it, vi } from "vitest"
import { runMcpAgenticLoop, type ToolResult, type ToolTurnDriver, type ToolTurnEvent } from "../../../src/lib/server/mcp/agentic-loop"
import type { McpClient } from "../../../src/lib/server/mcp/mcp-client"

const collect = async (stream: ReadableStream<Uint8Array>): Promise<{ event: string; data: unknown }[]> => {
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

async function* gen(events: ToolTurnEvent[]): AsyncIterable<ToolTurnEvent> {
	for (const e of events) yield e
}

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 }

describe("runMcpAgenticLoop", () => {
	it("executes a tool call then streams the final answer", async () => {
		const driver: ToolTurnDriver = {
			start: () =>
				gen([
					{ type: "tool_call", callId: "c1", toolName: "Search_SharePoint", arguments: '{"query":"budsjett"}' },
					{ type: "usage", usage }
				]),
			continueWith: (results: ToolResult[]) => {
				expect(results).toEqual([{ callId: "c1", toolName: "Search_SharePoint", output: "RESULT", isError: false }])
				return gen([
					{ type: "text_delta", itemId: "m1", content: "Svaret" },
					{ type: "usage", usage }
				])
			}
		}
		const mcp: McpClient = { listTools: vi.fn(), callTool: vi.fn().mockResolvedValue("RESULT") }
		const events = await collect(runMcpAgenticLoop(driver, mcp))

		expect(events.map((e) => e.event)).toEqual(["response.tool_call", "response.tool_result", "response.output_text.delta", "response.done"])
		expect(mcp.callTool).toHaveBeenCalledWith("Search_SharePoint", { query: "budsjett" })
	})

	it("stops at maxIterations and still emits done", async () => {
		const driver: ToolTurnDriver = {
			start: () => gen([{ type: "tool_call", callId: "c1", toolName: "loop", arguments: "{}" }]),
			continueWith: () => gen([{ type: "tool_call", callId: "c2", toolName: "loop", arguments: "{}" }])
		}
		const mcp: McpClient = { listTools: vi.fn(), callTool: vi.fn().mockResolvedValue("X") }
		const events = await collect(runMcpAgenticLoop(driver, mcp, { maxIterations: 2 }))
		expect(events.at(-1)?.event).toBe("response.done")
		expect((mcp.callTool as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(2)
	})

	it("emits tool_result error when a tool throws, and feeds error back", async () => {
		const seen: ToolResult[] = []
		const driver: ToolTurnDriver = {
			start: () => gen([{ type: "tool_call", callId: "c1", toolName: "bad", arguments: "{}" }]),
			continueWith: (results: ToolResult[]) => {
				seen.push(...results)
				return gen([{ type: "text_delta", itemId: "m1", content: "beklager" }])
			}
		}
		const mcp: McpClient = { listTools: vi.fn(), callTool: vi.fn().mockRejectedValue(new Error("boom")) }
		const events = await collect(runMcpAgenticLoop(driver, mcp))
		const toolResult = events.find((e) => e.event === "response.tool_result")
		expect((toolResult?.data as { status: string }).status).toBe("error")
		expect(seen[0]?.isError).toBe(true)
	})
})
