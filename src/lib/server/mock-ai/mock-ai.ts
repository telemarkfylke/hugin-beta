import { createSse } from "$lib/streaming.js";

// Markdown works (could move out to md file if needed)
const mockAiResponse = `Hello, this is a mock AI response streaming to you!
  Here's some more information from the mock AI.
  
  Finally, this is the last part of the mock AI response.
`

const mockResponseTokens = mockAiResponse.split(' ').map(token => token + ' ');

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const handleMockAiStream = (conversationId?: string): ReadableStream => {
  const messageId = `mock-message-${new Date().getTime()}`;
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse('conversation.started', { conversationId }));
      }
      for (const message of mockResponseTokens) {
        controller.enqueue(createSse('conversation.message.delta', { messageId, content: message }));
        // Simuler litt delay mellom meldingene
        await sleep(50);
      }
      controller.close()
    }
  })
  return readableStream;
}



