/** @typedef {import("openai/resources/responses/responses.mjs").ResponseStreamEvent} OpenAiResponseStreamEvent */
/** @typedef {import('openai/streaming').Stream<OpenAiResponseStreamEvent>} OpenAiStream */

/**
 *
 * @param {OpenAiStream} stream
 * @returns {ReadableStream}
 */
export const handleOpenAIStream = (stream) => {
  const textEncoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start (controller) {
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'response.created':
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify({ conversationId: chunk.response.conversation?.id })}\n\n`))
            break
          case 'response.output_text.delta':
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify({ messageId: chunk.item_id, content: chunk.delta })}\n\n`))
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}