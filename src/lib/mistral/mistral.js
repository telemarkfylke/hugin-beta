import { env } from "$env/dynamic/private";
import { Mistral } from "@mistralai/mistralai";
import { createSse } from "$lib/streaming.js";

const mistral = new Mistral({
  apiKey: env.MISTRAL_API_KEY,
});

/** @typedef {import("@mistralai/mistralai/models/components/conversationevents.js").ConversationEvents} MistralConversationEvents */
/** @typedef {import("@mistralai/mistralai/lib/event-streams.js").EventStream<MistralConversationEvents>} MistralEventStream */

/**
 * @param {MistralEventStream} stream
 * @param {string} [conversationId]
 * @returns {ReadableStream}
 */
export const handleMistralStream = (stream, conversationId) => {
  const textEncoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse('conversation.started', { conversationId }));
      }
      for await (const chunk of stream) {
        switch (chunk.event) {
          case 'conversation.response.started':
            // @ts-ignore
            controller.enqueue(createSse('conversation.started', { MistralConversationId: chunk.data.conversationId }));
            break
          case 'message.output.delta':
            // @ts-ignore
            controller.enqueue(createSse('message.delta', { messageId: chunk.data.id, content: chunk.data.content }));
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}

/**
 * 
 * @param {string} conversationId 
 * @param {string} prompt 
 * @returns {Promise<import("@mistralai/mistralai/models/components/conversationresponse.js").ConversationResponse>}
 */
export const appendToMistralConversation = async (conversationId, prompt) => {
  // Implementer tillegg av melding til samtale mot Mistral her
  const response = await mistral.beta.conversations.append({
    conversationId: conversationId,
    conversationAppendRequest: {
      inputs: prompt,
    }
  });
  return response;
}

/**
 * 
 * @param {string} conversationId 
 * @param {string} prompt 
 * @returns 
 */
export const appendToMistralConversationStream = async (conversationId, prompt) => {
  // Implementer tillegg av melding til samtale mot Mistral her
  const stream = await mistral.beta.conversations.appendStream({
    conversationId,
    conversationAppendStreamRequest: {
      inputs: prompt,
    }
  });
  return stream;
}

/**
 * 
 * @param {string} agentId 
 * @param {string} initialPrompt 
 * @returns 
 */
export const createMistralConversation = async (agentId, initialPrompt) => {
  // Implementer opprettelse av samtale mot Mistral her
  // Implementer opprettelse av samtale mot Mistral her
  const conversationStarter = await mistral.beta.conversations.start({
    agentId,
    inputs: 'Hei fra backend'
  })

  const response = await appendToMistralConversation(conversationStarter.conversationId, initialPrompt);
  return { mistralConversationId: conversationStarter.conversationId, response };
}

/**
 *
 * @param {string} agentId
 * @param {string} initialPrompt
 */
export const createMistralConversationStream = async (agentId, initialPrompt) => {
  // Implementer opprettelse av samtale mot Mistral her
  const conversationStarter = await mistral.beta.conversations.start({
    agentId,
    inputs: 'Hei fra backend'
  })

  const stream = await appendToMistralConversationStream(conversationStarter.conversationId, initialPrompt);
  return { mistralConversationId: conversationStarter.conversationId, stream };
}

