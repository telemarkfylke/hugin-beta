<script lang="ts">
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";
  import { page } from "$app/state";
  import { parseSse } from "$lib/streaming.js";
  import { z } from "zod";
  
  // Internal types
  const FrontendConversationMessage = z.object({
    type: z.enum(['user', 'agent']),
    content: z.string()
  });
  type FrontendConversationMessage = z.infer<typeof FrontendConversationMessage>;

  const FrontendConversation = z.object({
    id: z.string().nullable(),
    messages: z.record(FrontendConversationMessage)
  });
  type FrontendConversation = z.infer<typeof FrontendConversation>;

  // State for current agent chat
  const agentId: string = page.params.agentId as string;
  let prompt = ''
  let files = new DataTransfer().files

  $: console.log("Selected files:", files);

  const conversation: FrontendConversation = {
    id: null, // Conversation ID will be set after the first message
    messages: {} // Store messages as an object with messageId as keys
  }

  // Methods for handling conversation
  const resetConversation = (): void => {
    conversation.id = null
    conversation.messages = {}
    prompt = ''
  };

  const createConversation = async (userPrompt: string): Promise<Response> => {
    return await fetch(`/api/agents/${agentId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ prompt: userPrompt, stream: true })
    });
  };


  const appendMessageToConversation = async (userPrompt: string): Promise<Response> => {
    return await fetch(`/api/agents/${agentId}/conversations/${conversation.id}`, {
      method: "POST",
      body: JSON.stringify({ prompt: userPrompt, stream: true })
    });
  };

  const addUserMessageToConversation = (userPrompt: string): string => {
    const messageId = `user-${Date.now()}`; // Simple unique ID based on timestamp
    conversation.messages[messageId] = {
      type: 'user',
      content: userPrompt
    };
    prompt = ''; // Clear input prompt in local state (hmm, might be better to do this outside function to keep function pure?)
    return userPrompt
  };

  const handleNewMessage = async (event: Event): Promise<void> => {
    event.preventDefault(); // We use form for "correct" html (accessibility, enter key support, etc), but prevent default submission behavior, since we just handle it with js internally.
    // Fetch response and add agent message to conversation
    const userPrompt = addUserMessageToConversation(prompt); // Keep it as const to avoid mutation issues in async flow
    
    try {
      const response = conversation.id ? await appendMessageToConversation(userPrompt) : await createConversation(userPrompt);
      if (!response || !response.ok) {
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
        // console.log("Chat response text:", chatResponseText)
        const chatResponse = parseSse(chatResponseText)
        for (const chatResult of chatResponse) {
          // console.log("Chat result:", chatResult)
          switch (chatResult.event) {
            case 'conversation.started':
              const { conversationId } = chatResult.data
              conversation.id = conversationId
              console.log("Conversation started with ID:", conversationId)
              break;
            /*
            case 'conversation.vectorstore.created':
              const { vectorStoreId } = chatResult.data
              conversation.vectorStoreId = vectorStoreId
              console.log("Vector store created with ID:", vectorStoreId)
              break;
            */
            case 'conversation.message.delta':
              const { messageId, content } = chatResult.data
              if (!conversation.messages[messageId]) {
                conversation.messages[messageId] = { type: 'agent', content: '' }
              }
              conversation.messages[messageId].content += content // Append content to the message
              break;
            default:
              console.warn("Unhandled chat result event:", chatResult.event)
              break;
          }
        }
        if (done) break
      }
    } catch (error) {
      console.error("Error handling new message:", error)
    }
  };

  const uploadFiles = async (conversationId: string | null): Promise<void> => {
    if (!conversationId) {
      console.error("Cannot upload files: conversationId is null");
      return;
    }
    // Hvis vi ikke har conversationId, må først starte opp en samtale her...
    // Post api/agents/{agentId}/conversations/{conversationId}/{vectorStoreId}/files
    const formData = new FormData();
    formData.append('stream', 'true');
    for (let i = 0; i < files.length; i++) {
      formData.append('files[]', files[i] as File);
    }
    try {
      const response = await fetch(`/api/agents/${agentId}/conversations/${conversationId}/files`, {
        method: 'POST',
        body: formData
      });
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
        // console.log("Chat response text:", chatResponseText)
        const uploadResponse = parseSse(chatResponseText)
        for (const uploadResult of uploadResponse) {
          console.log("Upload result:", uploadResult)
          switch (uploadResult.event) {
            case 'conversation.document.uploaded':
              const { documentId, fileName } = uploadResult.data
              console.log(`Document uploaded: ${fileName} (ID: ${documentId})`)
              break;
            case 'conversation.document.processed':
              const { processedDocumentId, status } = uploadResult.data
              console.log(`Document processed: ID ${processedDocumentId}, status: ${status}`)
              break;
            default:
              console.warn("Unhandled upload result event:", uploadResult.event)
              break;
          }
        }
        if (done) break
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    }
  };

</script>

<div>
  <h1>{agentId}</h1>

  <div id="conversation-info">
    <p>Conversation ID: {conversation.id}</p>
  </div>
  <div id="chat">
    <div class="chat-container">
      <div class="chat-messages">
        {#each Object.keys(conversation.messages) as messageId}
          <div class="chat-message">
            {@html markdownFormatter(conversation.messages[messageId]?.content || '')}
          </div>
        {/each}
        <!--{@html mdFormatter(chatResult)}-->
      </div>
      <div class="chat-input">
        <form onsubmit={handleNewMessage}>
          <input type="text" placeholder="Type your message..." bind:value={prompt} />
          <button type="submit">Send</button>
        </form>
        <input
          type="file"
          multiple
          accept=".png,.jpeg,.jpg,.webp,.gif,.pdf,.docx,.pptx,.epub,.csv,.txt,.md,.xlsx,image/png,image/jpeg,image/jpg,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/epub+zip,text/csv,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          bind:files
          onchange={() => uploadFiles(conversation.id)}
        />
        <button onclick={resetConversation}>Reset</button>
      </div>
    </div>
  </div>
</div>
