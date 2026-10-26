import { describe, expect, it } from "vitest"
import type { ToolTurnEvent } from "../../../../src/lib/server/mcp/agentic-loop"
import { createOpenAIToolDriver } from "../../../../src/lib/server/mcp/drivers/openai-tool-driver"
import { MAX_OUTPUT_TOKENS } from "../../../../src/lib/server/models/models.config"
import { OUTPUT_LIMIT_NOTICE } from "../../../../src/lib/server/openai/openai-mapping"
import type { ChatRequest } from "../../../../src/lib/types/chat"

const chatRequest = {
	config: {
		_id: "1",
		name: "n",
		description: "",
		vendorId: "OPENAI",
		project: "DEFAULT",
		model: "gpt-5.6-terra",
		instructions: "sys",
		type: "private",
		accessGroups: ["all"],
		created: { at: "", by: { id: "" } },
		updated: { at: "", by: { id: "" } }
	},
	inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "hei" }] }],
	stream: true
} as unknown as ChatRequest

// Mirrors the real openai.responses.create stream: an async iterable of Response streaming events.
async function* responseStream(chunks: unknown[]) {
	for (const c of chunks) yield c
}

const drain = async (it: AsyncIterable<ToolTurnEvent>): Promise<ToolTurnEvent[]> => {
	const out: ToolTurnEvent[] = []
	for await (const e of it) out.push(e)
	return out
}

describe("createOpenAIToolDriver", () => {
	it("includes a web_search_preview tool alongside MCP function tools when config.tools has a web_search entry", async () => {
		const createCalls: unknown[] = []
		const chatRequestWithWebSearch = {
			...chatRequest,
			config: { ...chatRequest.config, tools: [{ type: "web_search" }] }
		} as unknown as ChatRequest
		const fakeOpenAI = {
			responses: {
				create: async (request: unknown) => {
					createCalls.push(request)
					return responseStream([])
				}
			}
		}
		const driver = createOpenAIToolDriver(fakeOpenAI as never, chatRequestWithWebSearch, [{ name: "Search_SharePoint", description: "d", inputSchema: {} }])
		await drain(driver.start())

		expect(createCalls).toHaveLength(1)
		expect(createCalls[0]).toMatchObject({
			tools: [{ type: "web_search_preview" }, { type: "function", name: "Search_SharePoint" }]
		})
	})

	it("omits the web_search_preview tool when config.tools has no web_search entry", async () => {
		const createCalls: unknown[] = []
		const fakeOpenAI = {
			responses: {
				create: async (request: unknown) => {
					createCalls.push(request)
					return responseStream([])
				}
			}
		}
		const driver = createOpenAIToolDriver(fakeOpenAI as never, chatRequest, [{ name: "Search_SharePoint", description: "d", inputSchema: {} }])
		await drain(driver.start())

		expect(createCalls).toHaveLength(1)
		expect(createCalls[0]).toMatchObject({
			tools: [{ type: "function", name: "Search_SharePoint" }]
		})
	})

	it("caps every round's output at MAX_OUTPUT_TOKENS", async () => {
		const createCalls: unknown[] = []
		const fakeOpenAI = {
			responses: {
				create: async (request: unknown) => {
					createCalls.push(request)
					return responseStream([])
				}
			}
		}
		await drain(createOpenAIToolDriver(fakeOpenAI as never, chatRequest, []).start())
		expect(createCalls[0]).toMatchObject({ max_output_tokens: MAX_OUTPUT_TOKENS })
	})

	it("emits text_delta from a response.output_text.delta chunk", async () => {
		const fakeOpenAI = {
			responses: {
				create: async () => responseStream([{ type: "response.output_text.delta", item_id: "msg_1", delta: "Hallo" }])
			}
		}
		const driver = createOpenAIToolDriver(fakeOpenAI as never, chatRequest, [])
		const events = await drain(driver.start())
		expect(events.find((e) => e.type === "text_delta")).toMatchObject({ type: "text_delta", itemId: "msg_1", content: "Hallo" })
	})
})

describe("createOpenAIToolDriver - a round cut off by MAX_OUTPUT_TOKENS", () => {
	it("still reports the billed usage, and tells the user the answer was cut off", async () => {
		const fakeOpenAI = {
			responses: {
				create: async () =>
					responseStream([
						{ type: "response.output_text.delta", item_id: "msg_1", delta: "Et langt svar" },
						{
							type: "response.incomplete",
							response: { id: "r1", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 10, output_tokens: 32000, total_tokens: 32010 } }
						}
					])
			}
		}
		const events = await drain(createOpenAIToolDriver(fakeOpenAI as never, chatRequest, []).start())

		expect(events).toContainEqual({ type: "text_delta", itemId: "msg_1", content: OUTPUT_LIMIT_NOTICE })
		expect(events).toContainEqual({ type: "usage", usage: { inputTokens: 10, outputTokens: 32000, totalTokens: 32010 } })
	})

	it("reports usage without a notice when incomplete for another reason", async () => {
		const fakeOpenAI = {
			responses: {
				create: async () =>
					responseStream([{ type: "response.incomplete", response: { id: "r1", incomplete_details: { reason: "content_filter" }, usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 } } }])
			}
		}
		const events = await drain(createOpenAIToolDriver(fakeOpenAI as never, chatRequest, []).start())

		expect(events).toEqual([{ type: "usage", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }])
	})
})
