import { logger } from "@vestfoldfylke/loglady"
import type { AbortableAsyncIterator, ChatResponse } from "ollama"
import { createSse } from "$lib/streaming.js"
import type { IAIVendorStreamHandler } from "$lib/types/AIVendor"
import { classifyOllamaError } from "./ollama-diagnostics"

export const handleOllamaChatStream: IAIVendorStreamHandler<AbortableAsyncIterator<ChatResponse>> = (chatRequest, ollamaStream) => {
	return new ReadableStream({
		async start(controller) {
			const responseId = crypto.randomUUID()
			const itemId = crypto.randomUUID()
			const startedAt = Date.now()

			controller.enqueue(createSse({ event: "response.started", data: { responseId } }))

			try {
				for await (const chunk of ollamaStream) {
					if (chunk.message?.content) {
						controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId, content: chunk.message.content } }))
					}

					if (chunk.done) {
						logger.info(
							"[ollama] Stream done (model: {model}, inputTokens: {inputTokens}, outputTokens: {outputTokens}, {durationMs} ms)",
							chatRequest.config.model ?? "none",
							chunk.prompt_eval_count || 0,
							chunk.eval_count || 0,
							Date.now() - startedAt
						)
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
				// The client only gets a generic stream_error - the cause (dropped connection, proxy timeout) is only visible here
				const { kind, status, code } = classifyOllamaError(error)
				logger.errorException(
					error,
					"[ollama] Stream failed mid-response (kind: {kind}, status: {status}, code: {code}, model: {model}, after {durationMs} ms)",
					kind,
					status ?? "none",
					code ?? "none",
					chatRequest.config.model ?? "none",
					Date.now() - startedAt
				)
				controller.enqueue(createSse({ event: "response.error", data: { code: "stream_error", message: error instanceof Error ? error.message : "Unknown stream error" } }))
			}

			controller.close()
		}
	})
}
