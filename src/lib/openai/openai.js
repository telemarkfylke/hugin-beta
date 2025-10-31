import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { createSse } from "$lib/streaming.js";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/** @typedef {import("openai/resources/responses/responses.mjs").ResponseStreamEvent} OpenAiResponseStreamEvent */
/** @typedef {import('openai/streaming').Stream<OpenAiResponseStreamEvent>} OpenAiStream */

/**
 *
 * @param {OpenAiStream} stream
 * @param {string} [conversationId]
 * @returns {ReadableStream}
 */
export const handleOpenAIStream = (stream, conversationId) => {
  const textEncoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse('conversation.started', { conversationId }));
      }
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'response.created':
            controller.enqueue(createSse('conversation.started', { openAIConversationId: chunk.response.conversation?.id }));
            break
          case 'response.output_text.delta':
            controller.enqueue(createSse('message.delta', { messageId: chunk.item_id, content: chunk.delta }));
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}

export const appendToOpenAIConversation = async (promptId, conversationId, prompt) => {
  // Create response and return
  const response = await openai.responses.create({
    stream: false,
    prompt: {
      id: promptId
    },
    conversation: conversationId,
    input: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })
  return response;
}

export const appendToOpenAIConversationStream = async (promptId, conversationId, prompt) => {
  // Create response and return
  const stream = await openai.responses.create({
    stream: true,
    prompt: {
      id: promptId
    },
    conversation: conversationId,
    input: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })
  return stream;
}

/**
 * @param {string} promptId
 * @param {string} prompt 
 */
export const createOpenAIConversation = async (promptId, prompt) => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" },
    items: [
      { type: "message", role: "user", content: "Hello!" }
    ],
  });

  const response = await appendToOpenAIConversation(promptId, conversation.id, prompt);
  return { openAiConversationId: conversation.id, response }
}

/**
 * @param {string} promptId
 * @param {string} prompt 
 */
export const createOpenAIConversationStream = async (promptId, prompt) => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" },
    items: [
      { type: "message", role: "user", content: "Hello!" }
    ],
  });

  // Create response and return
  const stream = await appendToOpenAIConversationStream(promptId, conversation.id, prompt);
  return { openAiConversationId: conversation.id, stream }
}

