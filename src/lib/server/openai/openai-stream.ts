import type { ResponseStreamEvent } from "openai/resources/responses/responses"
import type { Stream } from "openai/streaming"
import { createSse } from "$lib/streaming.js"

export const handleOpenAIStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
	return new ReadableStream({
		async start(controller) {
			if (conversationId) {
				controller.enqueue(createSse({ event: "conversation.started", data: { conversationId } }))
			}
			for await (const chunk of stream) {
				switch (chunk.type) {
					case "response.created":
						// controller.enqueue(createSse('conversation.started', { openAIConversationId: chunk.response.conversation?.id }));
						break
					case "response.output_text.delta":
						controller.enqueue(createSse({ event: "conversation.message.delta", data: { messageId: chunk.item_id, content: chunk.delta } }))
						break
					case "response.completed":
						controller.enqueue(createSse({ event: "conversation.message.ended", data: { totalTokens: chunk.response.usage?.total_tokens || 0 } }))
						break
					case "response.failed":
						controller.enqueue(createSse({ event: "error", data: { message: chunk.response.error?.message || "Unknown error" } }))
						break
					default:
						console.warn("Unhandled OpenAI stream event type:", chunk.type)
						break
					// Ta hensyn til flere event typer her etter behov
				}
			}
			controller.close()
		}
	})
}
