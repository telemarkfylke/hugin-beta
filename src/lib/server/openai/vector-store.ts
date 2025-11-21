import { createSse } from "$lib/streaming.js";
import { openai } from "./openai";

/**
 * Upload documents to OpenAI Vector Store. 
 */
export const uploadFilesToOpenAIVectorStore = async (conversationId: string, vectorStoreId: string | null, files: File[], streamResponse: boolean): Promise<{ vectorStoreId: string, readableStream: ReadableStream }> => {
  if (!conversationId) {
    throw new Error('conversationId is required to upload files to OpenAI library');
  }
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to upload files to OpenAI library');
  }
  if (!vectorStoreId) {
    // Da kan vi lage en vector store her først
    const vectorStore = await openai.vectorStores.create({
      name: `vectorstore-for-conversation-${conversationId}`,
      description: 'Vector store created for conversation file uploads',
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
            controller.enqueue(createSse({ event: 'conversation.vectorstore.file.uploaded', data: { fileId: result.id, fileName: result.filename } }));
          } catch (error) {
            controller.enqueue(createSse({ event: 'error', data: { message: `Error uploading file ${file.name} to OpenAI library: ${error}` } }));
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
              controller.enqueue(createSse({ event: 'error', data: { message: `Error processing files in batch id ${batchResult.id}: status ${batchResult.status}` } }));
            }
            // Wait for a few seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          controller.enqueue(createSse({ event: 'conversation.vectorstore.files.processed', data: { files: fileIds.map(id => ({ fileId: id })), vectorStoreId } }));
        } catch (error) {
          controller.enqueue(createSse({ event: 'error', data: { message: `Error uploading documents to Open AI Vector store: ${error}` } }));
          controller.close();
        }
        controller.close();
      }
    })

    return { vectorStoreId, readableStream };
  }

  throw new Error('Regular upload not implemented yet');
}

