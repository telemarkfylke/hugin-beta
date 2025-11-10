import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { createSse } from "$lib/streaming.js";
import type { Stream } from "openai/streaming";
import type { Response, ResponseStreamEvent } from "openai/resources/responses/responses";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const handleOpenAIStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
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

export const appendToOpenAIConversation = async (promptId: string, conversationId: string, prompt: string): Promise<Response> => {
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

export const appendToOpenAIConversationStream = async (promptId: string, conversationId: string, prompt: string): Promise<Stream<ResponseStreamEvent>> => {
  // Create response and return
  return await openai.responses.create({
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
}

export const createOpenAIConversation = async (promptId: string, prompt: string): Promise<{openAiConversationId: string, response: Response}> => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" }
  });

  const response = await appendToOpenAIConversation(promptId, conversation.id, prompt);
  return { openAiConversationId: conversation.id, response }
}

export const createOpenAIConversationStream = async (promptId: string, prompt: string): Promise<{openAiConversationId: string, stream: Stream<ResponseStreamEvent>}> => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" }
  });

  // Create response and return
  const stream = await appendToOpenAIConversationStream(promptId, conversation.id, prompt);
  return { openAiConversationId: conversation.id, stream }
}

