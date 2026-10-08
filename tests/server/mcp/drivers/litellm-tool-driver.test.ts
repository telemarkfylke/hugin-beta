import { describe, expect, it } from "vitest"
import type { ToolTurnEvent } from "../../../../src/lib/server/mcp/agentic-loop"
import { createLitellmToolDriver } from "../../../../src/lib/server/mcp/drivers/litellm-tool-driver"
import type { ChatRequest } from "../../../../src/lib/types/chat"

const chatRequest = {
	config: {
		_id: "1",
		name: "n",
		description: "",
		vendorId: "LITELLM",
		project: "DEFAULT",
		model: "m",
		instructions: "sys",
		type: "private",
		accessGroups: ["all"],
		created: { at: "", by: { id: "" } },
		updated: { at: "", by: { id: "" } }
	},
	inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "hei" }] }],
	stream: true
} as unknown as ChatRequest

async function* completionStream(chunks: unknown[]) {
	for (const c of chunks) yield c
}

const drain = async (it: AsyncIterable<ToolTurnEvent>): Promise<ToolTurnEvent[]> => {
	const out: ToolTurnEvent[] = []
	for await (const e of it) out.push(e)
	return out
}

describe("createLitellmToolDriver", () => {
	it("emits a tool_call assembled from streamed tool_call deltas", async () => {
		const fakeClient = {
			chat: {
				completions: {
					create: async () =>
						completionStream([
							{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "Search_SharePoint", arguments: '{"que' } }] } }] },
							{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"x"}' } }] }, finish_reason: "tool_calls" }] },
							{ choices: [{ delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } }
						])
				}
			}
		}
		const driver = createLitellmToolDriver(fakeClient as never, chatRequest, [])
		const events = await drain(driver.start())
		const toolCall = events.find((e) => e.type === "tool_call")
		expect(toolCall).toEqual({ type: "tool_call", callId: "call_1", toolName: "Search_SharePoint", arguments: '{"query":"x"}' })
	})

	it("emits text_delta for content chunks", async () => {
		const fakeClient = {
			chat: { completions: { create: async () => completionStream([{ id: "cmpl_1", choices: [{ delta: { content: "Hallo" }, finish_reason: null }] }]) } }
		}
		const driver = createLitellmToolDriver(fakeClient as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "text_delta")).toMatchObject({ type: "text_delta", content: "Hallo" })
	})
})
