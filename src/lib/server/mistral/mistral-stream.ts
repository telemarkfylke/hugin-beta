import type { EventStream } from "@mistralai/mistralai/lib/event-streams"
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents"
import { createSse } from "$lib/streaming.js"
import type { IAIVendorStreamHandler } from "$lib/types/AIVendor"

export const handleMistralResponseStream: IAIVendorStreamHandler<EventStream<ConversationEvents>> = (_chatRequest, mistralStream) => {
	return new ReadableStream({
		async start(controller) {
			// Enqueue config event with data
			// controller.enqueue(createSse({ event: "response.config", data: chatRequest.config })) hva er denne til?
			for await (const chunk of mistralStream) {
				switch (chunk.data.type) {
					case "conversation.response.started":
						controller.enqueue(createSse({ event: "response.started", data: { responseId: chunk.data.conversationId } }))
						break
					case "message.output.delta": {
						const content = chunk.data.content
						if (typeof content === "string") {
							controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId: chunk.data.id, content } }))
						} else if (content.type === "tool_reference") {
							if (content.url) {
								controller.enqueue(
									createSse({
										event: "response.annotations",
										data: {
											itemId: chunk.data.id,
											annotations: [{ type: "url_citation" as const, url: content.url, title: content.title }]
										}
									})
								)
							}
						} else if (content.type === "text") {
							controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId: chunk.data.id, content: content.text } }))
						}
						break
					}
					case "tool.execution.started":
					case "tool.execution.delta":
					case "tool.execution.done":
						break
					case "conversation.response.done":
						controller.enqueue(
							createSse({
								event: "response.done",
								data: { usage: { inputTokens: chunk.data.usage?.promptTokens || 0, outputTokens: chunk.data.usage?.completionTokens || 0, totalTokens: chunk.data.usage?.totalTokens || 0 } }
							})
						)
						break
					case "conversation.response.error":
						controller.enqueue(createSse({ event: "response.error", data: { code: chunk.data.code.toString(), message: chunk.data.message } }))
						break
					default:
						console.warn("Unhandled Mistral response stream event type:", chunk.data.type)
						break
					// Ta hensyn til flere event typer her etter behov
				}
			}
			controller.close()
		}
	})
}
