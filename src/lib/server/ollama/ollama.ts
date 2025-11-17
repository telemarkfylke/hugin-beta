import { env } from "$env/dynamic/private";
import type { OllamaAIResponseConfig } from "$lib/types/agents";
import type { Stream } from "openai/streaming";
import type { Response, ResponseStreamEvent } from "openai/resources/responses/responses";


type OllamaResponse = Response | Stream<ResponseStreamEvent> | null

type CreateResponse = {
    openAiConversationId: string,
    response: OllamaResponse
}


export const handleOllamaStream = (stream: Stream<ResponseStreamEvent>, conversationId?: string): ReadableStream | null => {

    /*
    const readableStream = new ReadableStream({
      async start (controller) {
        if (conversationId) {
          controller.enqueue(createSse('conversation.started', { conversationId }));
        }
        for await (const chunk of stream) {
          switch (chunk.type) {
            case 'response.created':
              // controller.enqueue(createSse('conversation.started', { openAIConversationId: chunk.response.conversation?.id }));
              break
            case 'response.output_text.delta':
              controller.enqueue(createSse('conversation.message.delta', { messageId: chunk.item_id, content: chunk.delta }));
              break
            // Ta hensyn til flere event typer her etter behov
          }
        }
        controller.close()
      }
    })
      */
    return null;
}


export const createOllamaAIConversation = async (ollamaAiResponseConfig: OllamaAIResponseConfig, prompt: string, streamResponse: boolean): Promise<CreateResponse> => {

    /*    // Lokale api kall
    
        const conversation = await openai.conversations.create({
            metadata: { topic: "demo" }
        });
        // Må vi kanskje lage en vector store også, og knytte den til samtalen her?
    
        const response = await appendToOpenAIConversation(openAiResponseConfig, conversation.id, prompt, streamResponse);
        */
    const reply: CreateResponse = {
        openAiConversationId: 'mock',
        response: null
    }
    return reply
}



export const appendToOllamaConversation = async (openAiResponseConfig: OllamaAIResponseConfig, openAIConversationId: string, prompt: string, streamResponse: boolean): Promise<OllamaResponse> => {
    // Create response and return
    // Kommunisere med lokala servere
    return null
}