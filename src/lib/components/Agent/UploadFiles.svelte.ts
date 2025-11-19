// Keeps track of the entire state of an agent component (async stuff are allowed here)
import { parseSse } from "$lib/streaming.js";

export const getConversationFiles = async (agentId: string, conversationId: string, setConversationFiles: (files: File[]) => void): Promise<void> => {
  if (!agentId || !conversationId) {
    throw new Error("agentId and conversationId are required to fetch conversation files");
  }
  const filesResponse = await fetch(`/api/agents/${agentId}/conversations/${conversationId}/files`);
  if (!filesResponse.ok) {
    throw new Error(`HTTP error! status: ${filesResponse.status}`);
  }
  const filesData = await filesResponse.json();
  setConversationFiles(filesData.files);
}

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
        case 'conversation.vectorstore.file.uploaded': {
          const { fileId, fileName  } = uploadResult.data;
          console.log(`File uploaded: ${fileName} (ID: ${fileId})`)
          addAgentMessageToConversation(`${fileId}-msg`, `File "${fileName}" uploaded successfully. Processing...`) // Temporary message, må finne på noe penere
          break;
        }
        case 'conversation.vectorstore.files.processed': {
          const { files } = uploadResult.data;
          console.log('Files processed:', files.map(file => file.fileId).join(', '));
          addAgentMessageToConversation(`${files.map(file => file.fileId).join(', ')}-msg`, `Files processed successfully.`) // Temporary message, må finne på noe penere
          break;
        }
        default:
          console.warn("Unhandled upload result event:", uploadResult.event)
          break;
      }
    }
    if (done) break
  }
}
