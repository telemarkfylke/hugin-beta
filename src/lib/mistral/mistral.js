
/** @typedef {import("@mistralai/mistralai/models/components/conversationevents.js").ConversationEvents} MistralConversationEvents */
/** @typedef {import("@mistralai/mistralai/lib/event-streams.js").EventStream<MistralConversationEvents>} MistralEventStream */

/**
 * @param {MistralEventStream} stream
 * @returns {ReadableStream}
 */
export const handleMistralStream = (stream) => {
  const textEncoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start (controller) {
      for await (const chunk of stream) {
        switch (chunk.event) {
          case 'conversation.response.started':
            // @ts-ignore
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify({ conversationId: chunk.data.conversationId })}\n\n`))
            break
          case 'message.output.delta':
            // @ts-ignore
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify({ messageId: chunk.data.id, content: chunk.data.content })}\n\n`))
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}