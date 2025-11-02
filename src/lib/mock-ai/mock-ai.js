import { createSse } from "$lib/streaming.js";

// Markdown works (could move out to md file if needed)
const mockAiResponse = `Hello, this is a mock AI response streaming to you!
  Here's some more information from the mock AI.
  
  Finally, this is the last part of the mock AI response.
`

const mockResponseTokens = mockAiResponse.split(' ').map(token => token + ' ');

/**
 * 
 * @param {number} ms 
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {string} [conversationId]
 * @returns {ReadableStream}
 */
export const handleMockAiStream = (conversationId) => {
  const messageId = `mock-message-${new Date().getTime()}`;
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse('conversation.started', { conversationId }));
      }
      for (const message of mockResponseTokens) {
        controller.enqueue(createSse('message.delta', { messageId, content: message }));
        // Simuler litt delay mellom meldingene
        await sleep(50);
      }
      controller.close()
    }
  })
  return readableStream;
}



