import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { createSse } from "$lib/streaming.js";
import type { Stream } from "openai/streaming";
import type { Response, ResponseCreateParamsBase, ResponseStreamEvent, Tool } from "openai/resources/responses/responses";
import type { AgentConfig } from "$lib/types/agents";

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
          case 'response.completed':
            
            controller.enqueue(createSse({ event: 'conversation.message.ended', data: { totalTokens: chunk.response.usage?.total_tokens || 0 } }));
            break
          case 'response.failed':
            controller.enqueue(createSse({ event: 'error', data: { message: chunk.response.error?.message || "Unknown error" } }));
            break
          default:
            console.warn('Unhandled OpenAI stream event type:', chunk.type);
            break;
          // Ta hensyn til flere event typer her etter behov
        }
      }
      controller.close()
    }
  })
  return readableStream;
}

type OpenAIResponseConfigResult = {
  requestConfig: ResponseCreateParamsBase;
}

const createOpenAIResponseConfig = (agentConfig: AgentConfig, openAIConversationId: string, inputPrompt: string, userVectorStoreId: string | null, streamResponse: boolean): OpenAIResponseConfigResult => {
  if (agentConfig.type !== 'openai-response' && agentConfig.type !== 'openai-prompt') {
    throw new Error('Invalid agent config type for OpenAI response configuration');
  }
  if (agentConfig.type === 'openai-prompt') {
    return {
      requestConfig: {
        input: inputPrompt,
        prompt: {
          id: agentConfig.prompt.id
        },
        conversation: openAIConversationId,
        stream: streamResponse
      }
    }
  }
  // Now we know it's type 'openai-response'
  const openAIResponseConfig: ResponseCreateParamsBase = {
    model: agentConfig.model,
    conversation: openAIConversationId,
    input: inputPrompt,
    instructions: agentConfig.instructions || null,
    stream: streamResponse
  }
  const fileSearchTool: Tool = {
    type: 'file_search',
    vector_store_ids: []
  }
  // If we have userVectorStoreId and allowed, add it to tools
  if (agentConfig.fileSearchEnabled && userVectorStoreId) {
    fileSearchTool.vector_store_ids.push(userVectorStoreId);
  }
  // If we have preconfigured vectorStoreIds in agentConfig, add them too
  if (agentConfig.vectorStoreIds && agentConfig.vectorStoreIds.length > 0) {
    fileSearchTool.vector_store_ids.push(...agentConfig.vectorStoreIds);
  }
  // Add tool only if we have vector store ids
  if (fileSearchTool.vector_store_ids.length > 0) {
    openAIResponseConfig.tools = [fileSearchTool];
  }
  return {
    requestConfig: openAIResponseConfig
  }
}

export const appendToOpenAIConversation = async (agentConfig: AgentConfig, openAIConversationId: string, prompt: string, userVectorStoreId: string | null, streamResponse: boolean): Promise<Response | Stream<ResponseStreamEvent>> => {  
  // Create response and return
  const { requestConfig } = createOpenAIResponseConfig(agentConfig, openAIConversationId, prompt, userVectorStoreId, streamResponse);
  return await openai.responses.create(requestConfig);
}

export const createOpenAIConversation = async (agentConfig: AgentConfig, prompt: string, userVectorStoreId: string | null, streamResponse: boolean): Promise<{openAiConversationId: string, response: Response | Stream<ResponseStreamEvent>}> => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" }
  });
  // Må vi kanskje lage en vector store også, og knytte den til samtalen her?

  const response = await appendToOpenAIConversation(agentConfig, conversation.id, prompt, userVectorStoreId, streamResponse);
  return { openAiConversationId: conversation.id, response }
}
