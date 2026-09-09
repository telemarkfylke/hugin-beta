import { describe, expect, it } from "vitest"
import type { ToolTurnEvent } from "../../../../src/lib/server/mcp/agentic-loop"
import { createOpenAIToolDriver } from "../../../../src/lib/server/mcp/drivers/openai-tool-driver"
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
