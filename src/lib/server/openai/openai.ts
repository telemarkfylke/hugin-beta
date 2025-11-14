import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { createSse } from "$lib/streaming.js";
import type { Stream } from "openai/streaming";
import type { Response, ResponseStreamEvent } from "openai/resources/responses/responses";
import type { OpenAIAResponseConfig } from "$lib/types/agents";

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export const handleOpenAIStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream => {
  const readableStream = new ReadableStream({
    async start (controller) {
      if (conversationId) {
        controller.enqueue(createSse({ event: 'conversation.started', data: { conversationId } }));
      }
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'response.created':
            // controller.enqueue(createSse('conversation.started', { openAIConversationId: chunk.response.conversation?.id }));
            break
          case 'response.output_text.delta':
            controller.enqueue(createSse({ event: 'conversation.message.delta', data: { messageId: chunk.item_id, content: chunk.delta } }));
            break
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}


export const appendToOpenAIConversation = async (openAiResponseConfig: OpenAIAResponseConfig, openAIConversationId: string, prompt: string, streamResponse: boolean): Promise<Response | Stream<ResponseStreamEvent>> => {  
  // Create response and return
  // @ts-expect-error
  delete openAiResponseConfig.type; // Fjern type fra config objektet før vi sender til OpenAI TODO, løs dette
  return await openai.responses.create({
    ...openAiResponseConfig,
    conversation: openAIConversationId,
    input: prompt,
    stream: streamResponse
  })
}

export const createOpenAIConversation = async (openAiResponseConfig: OpenAIAResponseConfig, prompt: string, streamResponse: boolean): Promise<{openAiConversationId: string, response: Response | Stream<ResponseStreamEvent>}> => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" }
  });
  // Må vi kanskje lage en vector store også, og knytte den til samtalen her?

  const response = await appendToOpenAIConversation(openAiResponseConfig, conversation.id, prompt, streamResponse);
  return { openAiConversationId: conversation.id, response }
}
