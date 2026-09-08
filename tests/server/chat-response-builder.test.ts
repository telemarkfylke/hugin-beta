import { describe, expect, it } from "vitest"
import { applyChatSseEventToResponseObject } from "../../src/lib/chat-response-builder"
import type { ChatResponseObject } from "../../src/lib/types/chat"

const buildResponseObject = (): ChatResponseObject => ({
	id: "",
	type: "chat_response",
	config: { _id: "1", name: "n", description: "", vendorId: "OPENAI", project: "DEFAULT" } as ChatResponseObject["config"],
	createdAt: new Date().toISOString(),
	outputs: [],
	status: "in_progress",
	usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
})

describe("applyChatSseEventToResponseObject - tool events", () => {
	it("sets status to searching on response.tool_call, without throwing or dropping outputs", () => {
		const responseObject = buildResponseObject()
		applyChatSseEventToResponseObject(responseObject, { event: "response.tool_call", data: { itemId: "call_1", toolName: "Search_SharePoint" } })
		expect(responseObject.status).toBe("searching")
		expect(responseObject.outputs).toEqual([])
	})

	it("sets status to in_progress on a successful response.tool_result", () => {
		const responseObject = buildResponseObject()
		applyChatSseEventToResponseObject(responseObject, { event: "response.tool_result", data: { itemId: "call_1", toolName: "Search_SharePoint", status: "ok" } })
		expect(responseObject.status).toBe("in_progress")
	})

	it("sets status to in_progress (not failed) on an error response.tool_result - the loop may still recover", () => {
		const responseObject = buildResponseObject()
		applyChatSseEventToResponseObject(responseObject, { event: "response.tool_result", data: { itemId: "call_1", toolName: "Search_SharePoint", status: "error" } })
		expect(responseObject.status).toBe("in_progress")
	})

	it("survives a full tool-call sequence followed by a normal text delta and done", () => {
		const responseObject = buildResponseObject()
		applyChatSseEventToResponseObject(responseObject, { event: "response.tool_call", data: { itemId: "call_1", toolName: "Search_SharePoint" } })
		applyChatSseEventToResponseObject(responseObject, { event: "response.tool_result", data: { itemId: "call_1", toolName: "Search_SharePoint", status: "ok" } })
		applyChatSseEventToResponseObject(responseObject, { event: "response.output_text.delta", data: { itemId: "m1", content: "Svaret er 42" } })
		applyChatSseEventToResponseObject(responseObject, { event: "response.done", data: { usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 } } })
		expect(responseObject.status).toBe("completed")
		expect(responseObject.outputs).toHaveLength(1)
		expect(responseObject.outputs[0]).toMatchObject({ type: "message.output", content: [{ type: "output_text", text: "Svaret er 42" }] })
	})
})
