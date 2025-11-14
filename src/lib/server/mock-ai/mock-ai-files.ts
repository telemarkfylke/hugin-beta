import { createSse } from "$lib/streaming.js";
import { sleep } from "./mock-ai";

// Document libraries in Mistral are vector stores, but called libraries

export const uploadDocumentsToMockAI = async (libraryId: string, files: File[], streamResponse: boolean): Promise<ReadableStream> => {
  if (!libraryId) {
    throw new Error('libraryId is required to upload documents to Mistral');
  }
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to upload documents to Mistral');
  }
  // Maybe validate files types as well here
  if (streamResponse) {
    const readableStream = new ReadableStream({
      async start (controller) {
        for (const file of files) {
          try {
            await sleep(500); // Slight delay before starting upload
            controller.enqueue(createSse('conversation.document.uploaded', { documentId: 'tullball-id', fileName: file.name }));
            let documentProcessed = false;
            // Polling for document processing status
            let status = { processingStatus: 'Running' }; // Mocked status
            while (!documentProcessed) {
              console.log('Document status:', status.processingStatus);
              if (status.processingStatus === 'Completed') {
                documentProcessed = true;
                break;
              }
              if (status.processingStatus !== 'Running') {
                controller.enqueue(createSse('error', { message: `Error processing document ${file.name}: status ${status.processingStatus}` }));
              }
              // Wait for a few seconds before polling again
              await sleep(3000);
              // Then mock completed status
              status.processingStatus = 'Completed';
            }
            controller.enqueue(createSse('conversation.document.processed', { documentId: 'tullball-id', fileName: file.name }));
          } catch (error) {
            controller.enqueue(createSse('error', { message: `Error uploading document ${file.name} to Mock-AI: ${error}` }));
            controller.close();
            break;
          }
        }
        controller.close();
      }
    })
    return readableStream;
  }

  throw new Error('Regular upload (json response) not implemented yet');
}
