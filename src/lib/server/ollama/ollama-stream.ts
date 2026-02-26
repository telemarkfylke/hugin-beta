import type { AbortableAsyncIterator, ChatResponse } from "ollama"
import { createSse } from "$lib/streaming.js"
import type { IAIVendorStreamHandler } from "$lib/types/AIVendor"

export const handleOllamaChatStream: IAIVendorStreamHandler<AbortableAsyncIterator<ChatResponse>> = (_chatRequest, ollamaStream) => {
	return new ReadableStream({
		async start(controller) {
			const responseId = crypto.randomUUID()
			const itemId = crypto.randomUUID()

			controller.enqueue(createSse({ event: "response.started", data: { responseId } }))

			try {
				for await (const chunk of ollamaStream) {
					if (chunk.message?.content) {
						controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId, content: chunk.message.content } }))
					}

					if (chunk.done) {
						controller.enqueue(
							createSse({
								event: "response.done",
								data: {
									usage: {
										inputTokens: chunk.prompt_eval_count || 0,
										outputTokens: chunk.eval_count || 0,
										totalTokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0)
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
