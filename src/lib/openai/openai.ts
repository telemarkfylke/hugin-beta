import { env } from "$env/dynamic/private";
import OpenAI from "openai";
import { createSse } from "$lib/streaming.js";
import type { Stream } from "openai/streaming";
import type { Response, ResponseCreateParamsBase, ResponseCreateParamsNonStreaming, ResponseStreamEvent } from "openai/resources/responses/responses";
import type { OpenAIAResponseConfig } from "$lib/types/agents";

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
  return readableStream;
}


export const appendToOpenAIConversation = async (openAiResponseConfig: OpenAIAResponseConfig, prompt: string, streamResponse: boolean): Promise<Response | Stream<ResponseStreamEvent>> => {  
  // Create response and return
  delete openAiResponseConfig.type; // Fjern type fra config objektet før vi sender til OpenAI TODO, løs dette
  return await openai.responses.create({
    ...openAiResponseConfig,
    input: prompt,
    stream: streamResponse
  })
}

export const createOpenAIConversation = async (openAiResponseConfig: OpenAIAResponseConfig, prompt: string, streamResponse: boolean): Promise<{openAiConversationId: string, response: Response | Stream<ResponseStreamEvent>}> => {
  const conversation = await openai.conversations.create({
    metadata: { topic: "demo" }
  });
  // Må vi kanskje lage en vector store også, og knytte den til samtalen her?

  const response = await appendToOpenAIConversation(openAiResponseConfig, prompt, streamResponse);
  return { openAiConversationId: conversation.id, response }
}

export const uploadDocumentsToOpenAILibrary = async (conversationId: string, vectorStoreId: string | null, files: File[], streamResponse: boolean): Promise<{ vectorStoreId: string, readableStream: ReadableStream }> => {
  if (!conversationId) {
    throw new Error('conversationId is required to upload documents to OpenAI library');
  }
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to upload documents to Mistral');
  }
  if (!vectorStoreId) {
    // Da kan vi lage en vector store her først
    const vectorStore = await openai.vectorStores.create({
      name: `vectorstore-for-conversation-${conversationId}`,
      description: 'Vector store created for conversation document uploads',
      expires_after: {
        anchor: 'last_active_at',
        days: 1
      },
    });
    vectorStoreId = vectorStore.id;
    console.log('Created new OpenAI vector store with id:', vectorStoreId);
  }
  // Maybe validate files types as well here
  if (streamResponse) {
    const readableStream = new ReadableStream({
      async start (controller) {
        const fileIds: string[] = []
        for (const file of files) {
          try {
            const result = await openai.files.create({
              file,
              purpose: 'user_data',
              expires_after: {
                anchor: 'created_at',
                seconds: 86400 // 1 day
              }
            })
            fileIds.push(result.id);
            controller.enqueue(createSse('conversation.document.uploaded', { documentId: result.id, fileName: result.filename }));
          } catch (error) {
            controller.enqueue(createSse('error', { message: `Error uploading document ${file.name} to OpenAI library: ${error}` }));
            controller.close();
            break;
          }
        }
        // Now link files to vector store
        try {
          const batchCreationResult = await openai.vectorStores.fileBatches.create(vectorStoreId, { file_ids: fileIds });
          let batchProcessed = false;
          // Polling for document processing status
          while (!batchProcessed) {
            const batchResult = await openai.vectorStores.fileBatches.retrieve(batchCreationResult.id, { vector_store_id: vectorStoreId });
            console.log('Batch status:', batchResult.status);
            if (batchResult.status === 'completed') {
              await new Promise(resolve => setTimeout(resolve, 3000)); // Wait a bit to ensure document is fully processed
              batchProcessed = true;
              break;
            }
            if (batchResult.status !== 'in_progress') {
              controller.enqueue(createSse('error', { message: `Error processing documents in batch id ${batchResult.id}: status ${batchResult.status}` }));
            }
            // Wait for a few seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          controller.enqueue(createSse('conversation.document.processed', { documentIds: fileIds }));
        } catch (error) {
          controller.enqueue(createSse('error', { message: `Error uploading documents to Open AI Vector store: ${error}` }));
          controller.close();
        }
        controller.close();
      }
    })

    return { vectorStoreId, readableStream };
  }

  throw new Error('Regular upload not implemented yet');
}
