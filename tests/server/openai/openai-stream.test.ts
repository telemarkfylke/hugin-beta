import { describe, expect, it } from "vitest"
import { OUTPUT_LIMIT_NOTICE } from "$lib/server/openai/openai-mapping"
import { handleOpenAIResponseStream } from "$lib/server/openai/openai-stream"
import { parseSse } from "$lib/streaming"
import type { ChatRequest } from "$lib/types/chat"

async function* openAIStream(chunks: unknown[]) {
	for (const chunk of chunks) yield chunk
}

const eventsOf = async (chunks: unknown[]) => {
	const stream = handleOpenAIResponseStream({} as ChatRequest, openAIStream(chunks) as never)
	return parseSse(await new Response(stream).text())
}

const usage = { input_tokens: 10, output_tokens: 32000, total_tokens: 32010 }

describe("handleOpenAIResponseStream", () => {
	it("reports usage for a response cut off by MAX_OUTPUT_TOKENS, which ends in response.incomplete instead of response.completed", async () => {
		const events = await eventsOf([
			{ type: "response.output_text.delta", item_id: "msg_1", delta: "Et langt svar" },
			{ type: "response.incomplete", response: { id: "r1", incomplete_details: { reason: "max_output_tokens" }, usage } }
		])

		expect(events).toContainEqual({ event: "response.done", data: { usage: { inputTokens: 10, outputTokens: 32000, totalTokens: 32010 } } })
	})

	it("appends the cut-off notice to the answer itself", async () => {
		const events = await eventsOf([
			{ type: "response.output_text.delta", item_id: "msg_1", delta: "Et langt svar" },
			{ type: "response.incomplete", response: { id: "r1", incomplete_details: { reason: "max_output_tokens" }, usage } }
		])

		expect(events).toContainEqual({ event: "response.output_text.delta", data: { itemId: "msg_1", content: OUTPUT_LIMIT_NOTICE } })
	})

	it("still shows the notice when the whole budget went to reasoning and no text came at all", async () => {
		const events = await eventsOf([{ type: "response.incomplete", response: { id: "r1", incomplete_details: { reason: "max_output_tokens" }, usage } }])

		expect(events).toContainEqual({ event: "response.output_text.delta", data: { itemId: "cut_off_r1", content: OUTPUT_LIMIT_NOTICE } })
	})

	it("adds no notice to a normally completed response", async () => {
		const events = await eventsOf([
			{ type: "response.output_text.delta", item_id: "msg_1", delta: "Kort svar" },
			{ type: "response.completed", response: { id: "r1", usage } }
		])

		expect(events.filter((e) => e.event === "response.output_text.delta")).toHaveLength(1)
		expect(events.at(-1)?.event).toBe("response.done")
	})
})
