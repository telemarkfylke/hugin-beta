import { createSse } from "$lib/streaming.js";
import { sleep } from "./mock-ai";

type MockAiFile = {
  id: string;
  name: string;
  type: string;
  size: number;
}

const mockAiFileStore: MockAiFile[] = [];

export const getMockAiFiles = async (): Promise<{ documents: MockAiFile[] }> => {
  // For simplicity, we return all documents in the mock library
  return { documents: mockAiFileStore };
}

export const uploadFilesToMockAI = async (libraryId: string, files: File[], streamResponse: boolean): Promise<ReadableStream> => {
  if (!libraryId) {
    throw new Error('libraryId is required to upload files to Mock-AI');
  }
  if (!files || files.length === 0) {
    throw new Error('At least one file is required to upload files to Mock-AI');
  }
  // Maybe validate files types as well here
  if (streamResponse) {
    const readableStream = new ReadableStream({
      async start (controller) {
        for (const file of files) {
          try {
            await sleep(500); // Slight delay before starting upload
            controller.enqueue(createSse({ event: 'conversation.vectorstore.file.uploaded', data: { fileId: 'tullball-id', fileName: file.name }}));
            let fileProcessed = false;
            // Polling for document processing status
            let status = { processingStatus: 'Running' }; // Mocked status
            while (!fileProcessed) {
              console.log('Document status:', status.processingStatus);
              if (status.processingStatus === 'Completed') {
                fileProcessed = true;
                break;
              }
              if (status.processingStatus !== 'Running') {
                controller.enqueue(createSse({ event: 'error', data: { message: `Error processing document ${file.name}: status ${status.processingStatus}` }}));
              }
              // Wait for a few seconds before polling again
              await sleep(3000);
              // Then mock completed status
              status.processingStatus = 'Completed';
              mockAiFileStore.push({
                id: `tullball-id-${mockAiFileStore.length + 1}`,
                name: file.name,
                type: file.type,
                size: file.size
              });
            }
            controller.enqueue(createSse({ event: 'conversation.vectorstore.files.processed', data: { vectorStoreId: libraryId, files: [ { fileId: 'tullball-id' } ] }}));
          } catch (error) {
            controller.enqueue(createSse({ event: 'error', data: { message: `Error uploading document ${file.name} to Mock-AI: ${error}` }}));
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
