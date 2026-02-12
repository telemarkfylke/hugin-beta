import type { ResponseStreamEvent } from "openai/resources/responses/responses"
import type { Stream } from "openai/streaming"
import { createSse } from "$lib/streaming.js"
import type { IAIVendorStreamHandler } from "$lib/types/AIVendor"

export const handleOpenAIResponseStream: IAIVendorStreamHandler<Stream<ResponseStreamEvent>> = (_chatRequest, openAIStream) => {
	return new ReadableStream({
		async start(controller) {
			// Enqueue config event with data
			// controller.enqueue(createSse({ event: "response.config", data: chatRequest.config })) hva er denne til?
			for await (const chunk of openAIStream) {
				switch (chunk.type) {
					case "response.created":
					case "response.in_progress":
						controller.enqueue(createSse({ event: "response.started", data: { responseId: chunk.response.id } }))
						break
					case "response.output_text.delta":
						controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId: chunk.item_id, content: chunk.delta } }))
						break
					case "response.completed":
						controller.enqueue(
							createSse({
								event: "response.done",
								data: { usage: { inputTokens: chunk.response.usage?.input_tokens || 0, outputTokens: chunk.response.usage?.output_tokens || 0, totalTokens: chunk.response.usage?.total_tokens || 0 } }
							})
						)
						break
					case "response.failed":
						controller.enqueue(createSse({ event: "response.error", data: { code: chunk.response.error?.code || "unknown", message: chunk.response.error?.message || "Unknown error" } }))
						break
					// Websøkeventer kommer her etterhvert
					case "response.web_search_call.in_progress":
					case "response.web_search_call.searching":
					case "response.web_search_call.completed":
					case "response.output_item.added":
					case "response.output_item.done":
						console.log("Web search event:", chunk.type, JSON.stringify(chunk, null, 2))
    					break
					default:
						console.warn("Unhandled OpenAI response stream event type:", chunk.type)
						createSse({ event: "response.output_text.delta", data: { itemId: "unknown_open_ai_sse", content: JSON.stringify(chunk) } })
						break
					// Ta hensyn til flere event typer her etter behov

				}
			}
			controller.close()
		}
	})
}
