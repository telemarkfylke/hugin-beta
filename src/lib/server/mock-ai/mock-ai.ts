import { createSse } from "$lib/streaming.js";

// Markdown works (could move out to md file if needed)
const mockAiResponse = `Hello, this is a mock AI response streaming to you!
  Here's some more information from the mock AI.
  
  Finally, this is the last part of the mock AI response.
`

const mockResponseTokens = mockAiResponse.split(' ').map(token => `${token} `);

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const handleMockAiStream = (conversationId?: string): ReadableStream => {
  const messageId = `mock-message-${Date.now()}`;
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse({ event: 'conversation.started', data: { conversationId } }));
      }
      for (const message of mockResponseTokens) {
        controller.enqueue(createSse({ event: 'conversation.message.delta', data: { messageId, content: message } }));
        // Simuler litt delay mellom meldingene
        await sleep(50);
      }
      controller.enqueue(createSse({ event: 'conversation.message.ended', data: { totalTokens: mockResponseTokens.length } }));
      controller.close()
    }
  })
  return readableStream;
}



