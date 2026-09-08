import { describe, expect, it } from "vitest"
import type { ToolTurnEvent } from "../../../../src/lib/server/mcp/agentic-loop"
import { createMistralToolDriver } from "../../../../src/lib/server/mcp/drivers/mistral-tool-driver"
import type { ChatRequest } from "../../../../src/lib/types/chat"

const chatRequest = {
	config: {
		_id: "1",
		name: "n",
		description: "",
		vendorId: "MISTRAL",
		project: "DEFAULT",
		model: "mistral-large-latest",
		instructions: "sys",
		type: "private",
		accessGroups: ["all"],
		created: { at: "", by: { id: "" } },
		updated: { at: "", by: { id: "" } }
	},
	inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "hei" }] }],
	stream: true
} as unknown as ChatRequest

// Mirrors the real @mistralai/mistralai EventStream: each chunk is a ConversationEvents
// object whose discriminated payload lives on `.data` (see src/lib/server/mistral/mistral-stream.ts).
async function* eventStream(events: unknown[]) {
	for (const e of events) yield e
}

const drain = async (it: AsyncIterable<ToolTurnEvent>): Promise<ToolTurnEvent[]> => {
	const out: ToolTurnEvent[] = []
	for await (const e of it) out.push(e)
	return out
}

describe("createMistralToolDriver", () => {
	it("emits text_delta from a string message.output.delta event", async () => {
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () =>
						eventStream([
							{ event: "conversation.response.started", data: { type: "conversation.response.started", conversationId: "conv_1" } },
							{ event: "message.output.delta", data: { type: "message.output.delta", id: "msg_1", content: "Hallo" } }
						])
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "text_delta")).toMatchObject({ type: "text_delta", itemId: "msg_1", content: "Hallo" })
	})

	it("emits text_delta from a chunked (OutputContentChunks) message.output.delta event", async () => {
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () => eventStream([{ event: "message.output.delta", data: { type: "message.output.delta", id: "msg_2", content: { type: "text", text: "Verden" } } }])
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "text_delta")).toMatchObject({ type: "text_delta", itemId: "msg_2", content: "Verden" })
	})

	it("emits a tool_call from a function.call.delta event", async () => {
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () =>
						eventStream([
							{
								event: "function.call.delta",
								data: { type: "function.call.delta", id: "fc_1", outputIndex: 0, name: "Search_SharePoint", toolCallId: "tool_call_1", arguments: '{"query":"x"}' }
							}
						])
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "tool_call")).toEqual({ type: "tool_call", callId: "tool_call_1", toolName: "Search_SharePoint", arguments: '{"query":"x"}' })
	})

	it("emits usage from a conversation.response.done event", async () => {
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () => eventStream([{ event: "conversation.response.done", data: { type: "conversation.response.done", usage: { promptTokens: 3, completionTokens: 1, totalTokens: 4 } } }])
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "usage")).toEqual({ type: "usage", usage: { inputTokens: 3, outputTokens: 1, totalTokens: 4 } })
	})

	it("throws when a conversation.response.error event is received", async () => {
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () => eventStream([{ event: "conversation.response.error", data: { type: "conversation.response.error", code: 500, message: "upstream failure" } }])
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		await expect(drain(driver.start())).rejects.toThrow("upstream failure")
	})

	it("continues the conversation via appendStream using the stored conversationId and function-result entries", async () => {
		const appendCalls: unknown[] = []
		const fakeMistral = {
			beta: {
				conversations: {
					startStream: async () =>
						eventStream([
							{ event: "conversation.response.started", data: { type: "conversation.response.started", conversationId: "conv_42" } },
							{
								event: "function.call.delta",
								data: { type: "function.call.delta", id: "fc_1", outputIndex: 0, name: "Search_SharePoint", toolCallId: "tool_call_9", arguments: "{}" }
							}
						]),
					appendStream: async (request: unknown) => {
						appendCalls.push(request)
						return eventStream([{ event: "message.output.delta", data: { type: "message.output.delta", id: "msg_after", content: "ferdig" } }])
					}
				}
			}
		}
		const driver = createMistralToolDriver(fakeMistral as never, chatRequest, [])
		await drain(driver.start())
		const events = await drain(driver.continueWith([{ callId: "tool_call_9", toolName: "Search_SharePoint", output: "result text", isError: false }]))

		expect(appendCalls).toHaveLength(1)
		expect(appendCalls[0]).toMatchObject({
			conversationId: "conv_42",
			conversationAppendStreamRequest: {
				inputs: [{ type: "function.result", toolCallId: "tool_call_9", result: "result text" }]
			}
		})
		expect(events.find((e) => e.type === "text_delta")).toMatchObject({ type: "text_delta", content: "ferdig" })
	})
})
