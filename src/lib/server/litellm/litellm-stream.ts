import type { ChatCompletionChunk } from "openai/resources/chat/completions"
import type { Stream } from "openai/streaming"
import { createSse } from "$lib/streaming.js"
import type { IAIVendorStreamHandler } from "$lib/types/AIVendor"

export const handleLitellmChatStream: IAIVendorStreamHandler<Stream<ChatCompletionChunk>> = (_chatRequest, stream) => {
	return new ReadableStream({
		async start(controller) {
			const responseId = crypto.randomUUID()
			const itemId = crypto.randomUUID()

			controller.enqueue(createSse({ event: "response.started", data: { responseId } }))

			try {
				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta?.content
					if (delta) {
						controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId, content: delta } }))
					}

					if (chunk.choices[0]?.finish_reason) {
						controller.enqueue(
							createSse({
								event: "response.done",
								data: {
									usage: {
										inputTokens: chunk.usage?.prompt_tokens ?? 0,
										outputTokens: chunk.usage?.completion_tokens ?? 0,
										totalTokens: chunk.usage?.total_tokens ?? 0
									}
								}
							})
						)
					}
				}
			} catch (error) {
				controller.enqueue(createSse({ event: "response.error", data: { code: "stream_error", message: error instanceof Error ? error.message : "Unknown stream error" } }))
			}

			controller.close()
		}
	})
}
