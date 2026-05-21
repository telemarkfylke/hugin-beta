import { describe, expect, it } from "vitest"
import { createSse, createSseParser, parseSse } from "$lib/streaming"

describe("SSE helpers", () => {
	it("creates and parses valid SSE events", () => {
		const encoded = createSse({ event: "response.started", data: { responseId: "response-1" } })
		const text = new TextDecoder().decode(encoded)

		expect(parseSse(text)).toEqual([{ event: "response.started", data: { responseId: "response-1" } }])
	})

	it("parses multiple complete events in one chunk", () => {
		const decoder = new TextDecoder()
		const chunk = `${decoder.decode(createSse({ event: "response.started", data: { responseId: "response-1" } }))}${decoder.decode(createSse({ event: "response.done", data: { usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } } }))}`

		expect(parseSse(chunk)).toEqual([
			{ event: "response.started", data: { responseId: "response-1" } },
			{ event: "response.done", data: { usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } } }
		])
	})

	it("parses split events with the buffered parser", () => {
		const parser = createSseParser()

		expect(parser.push("event: response.started\n")).toEqual([])
		expect(parser.push('data: {"responseId":"response-1"}\n\n')).toEqual([{ event: "response.started", data: { responseId: "response-1" } }])
		expect(parser.flush()).toEqual([])
	})

	it("complete chunk parser still rejects incomplete events", () => {
		expect(() => parseSse("event: response.started\n")).toThrow("incomplete event")
	})

	it("rejects unknown event types", () => {
		expect(() => parseSse("event: unknown\ndata: {}\n\n")).toThrow()
	})
})
