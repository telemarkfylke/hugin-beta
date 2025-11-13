// Keeps track of the entire state of an agent component (async stuff are allowed here)
import { parseSse } from "$lib/streaming.js";

const postFilesToConversation = async (files: FileList, agentId: string, conversationId: string): Promise<Response> => {
  const formData = new FormData();
  formData.append('stream', 'true'); // assuming we want always want streaming in frontend
  for (let i = 0; i < files.length; i++) {
    formData.append('files[]', files[i] as File);
  }
  return await fetch(`/api/agents/${agentId}/conversations/${conversationId}/files`, {
    method: 'POST',
    body: formData
  });
};

export const uploadFilesToConversation = async (files: FileList, agentId: string, conversationId: string | null, addAgentMessageToConversation: (messageId: string, content: string) => void): Promise<void> => {
  if (!files || files.length === 0) {
    throw new Error("No files provided for upload");
  }
  if (!agentId || !conversationId) {
    throw new Error("agentId and conversationId are required to upload files to a conversation");
  }
  // OBS mulig vi vil støtte opplasting uten conversationId også senere? TODO, sjekk om det skal gjøres her, eller i AgentState eller i API.
  const response = await postFilesToConversation(files, agentId, conversationId);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Response body is null");
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  while (true) {
    const { value, done } = await reader.read()
    const chatResponseText = decoder.decode(value, { stream: true })
    const uploadResponse = parseSse(chatResponseText)
    for (const uploadResult of uploadResponse) {
      switch (uploadResult.event) {
        case 'conversation.document.uploaded':
          console.log(`Document uploaded: ${uploadResult.data.fileName} (ID: ${uploadResult.data.documentId})`)
          addAgentMessageToConversation(`${uploadResult.data.documentId}-msg`, `Document "${uploadResult.data.fileName}" uploaded successfully. Processing...`) // Temporary message, må finne på noe penere
          break;
        case 'conversation.document.processed':
          console.log(`Document processed: ID ${uploadResult.data.documentId}`)
          addAgentMessageToConversation(`${uploadResult.data.documentId}-msg`, `Document "${uploadResult.data.fileName}" processed successfully.`) // Temporary message, må finne på noe penere
          break;
        default:
          console.warn("Unhandled upload result event:", uploadResult.event)
          break;
      }
    }
    if (done) break
  }
}
