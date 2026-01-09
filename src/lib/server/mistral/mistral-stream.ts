import type { ResponseStreamEvent } from "openai/resources/responses/responses"
import type { ConversationEvents } from "@mistralai/mistralai/models/components/conversationevents"
import type { EventStream } from "@mistralai/mistralai/lib/event-streams"
import type { Stream } from "openai/streaming"
import { createSse } from "$lib/streaming.js"

export const handleOpenAIResponseStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
	return new ReadableStream({
		async start(controller) {
			if (conversationId) {
				controller.enqueue(createSse({ event: "conversation.created", data: { conversationId } }))
			}
			for await (const chunk of stream) {
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
					default:
						console.warn("Unhandled OpenAI response stream event type:", chunk.type)
						controller.enqueue(createSse({ event: "unknown", data: chunk }))
						break
					// Ta hensyn til flere event typer her etter behov
				}
			}
			controller.close()
		}
	})
}

export const handleMistralResponseStream = (stream: EventStream<ConversationEvents>, conversationId?: string): ReadableStream<Uint8Array> => {
	return new ReadableStream({
		async start(controller) {
			if (dbConversationId) {
				controller.enqueue(createSse({ event: "conversation.created", data: { conversationId: dbConversationId } }))
			}
			for await (const chunk of stream) {
				if (!["conversation.response.started", "message.output.delta"].includes(chunk.event)) {
					console.log("Mistral stream chunk event:", chunk.event, chunk.data)
				}
				// Types are not connected to the event in mistral... so we use type instead
				switch (chunk.data.type) {
					case "conversation.response.started":
						// controller.enqueue(createSse('conversation.started', { MistralConversationId: chunk.data.conversationId }));
						break
					case "message.output.delta":
						controller.enqueue(
							createSse({
								event: "conversation.message.delta",
								data: { messageId: chunk.data.id, content: typeof chunk.data.content === "string" ? chunk.data.content : "FIKK EN CHUNK SOM IKKE ER STRING, sjekk mistral-typen OutputContentChunks" }
							})
						)
						break
					case "conversation.response.done":
						controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.data.usage.totalTokens || 0 } }))
						break
					case "conversation.response.error":
						controller.enqueue(createSse({ event: "error", data: { message: chunk.data.message } }))
						break
					// Ta hensyn til flere event typer her etter behov
					default:
						console.warn("Unhandled Mistral stream event type:", chunk.data.type)
						console.log("Full chunk data:", chunk.data)
				}
			}
			controller.close()
		}
	})
}
