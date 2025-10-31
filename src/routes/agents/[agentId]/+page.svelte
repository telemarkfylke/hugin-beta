<script>
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";
  import { page } from "$app/state";
  import { parseSse } from "$lib/streaming.js";
  import { z } from "zod";
  
  // Internal types
  /** @typedef {z.infer<typeof FrontendConversationMessage>} */
  const FrontendConversationMessage = z.object({
    type: z.enum(['user', 'response']),
    content: z.string()
  });

  /** @typedef {z.infer<typeof FrontendConversation>} */
  const FrontendConversation = z.object({
    id: z.string().nullable(),
    messages: z.record(FrontendConversationMessage)
  });

  // State for current agent chat
  const agentId = page.params.agentId
  let prompt = ''

  /** @type {FrontendConversation} */
  const conversation = {
    id: null, // Conversation ID will be set after the first message
    messages: {} // Store messages as an object with messageId as keys
  }

  const createConversation = async () => {
    // Reset conversation state
    conversation.id = null;
    conversation.messages = {};
    return await fetch(`/api/agents/${agentId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ prompt: 'halla', stream: true })
    });
  };

  const appendMessageToConversation = async () => {
    return await fetch(`/api/agents/${agentId}/conversations/${conversation.id}`, {
      method: "POST",
      body: JSON.stringify({ prompt, stream: true })
    });
  };

  const handleNewMessage = async () => {
    try {
      const response = conversation.id ? await appendMessageToConversation() : await createConversation();
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
        console.log("Chat response text:", chatResponseText)
        const chatResponse = parseSse(chatResponseText)
        for (const chatResult of chatResponse) {
          console.log("Chat result:", chatResult)
          const { conversationId, messageId, content } = chatResult.data
          if (conversationId && conversation.id !== conversationId) { // New conversation
            conversation.id = conversationId
            conversation.messages = {} // Reset messages for new conversation
          }
          if (messageId) { // New message or append to existing message
            if (!conversation.messages[messageId]) {
              conversation.messages[messageId] = { type: 'response', content: '' }
            }
            conversation.messages[messageId].content += content // Append content to the message
          }
        }
        if (done) break
      }
    } catch (error) {
      console.error("Error handling new message:", error)
    }
  };
  

</script>

<h1>Agent Details</h1>

<div>
  <h1>{agentId}</h1>

  <div id="chat">
    <div class="chat-container">
      <div class="chat-header">
        <h2>En header</h2>
      </div>
      <div class="chat-messages">
        {#each Object.keys(conversation.messages) as messageId}
          <div class="chat-message">
            {@html markdownFormatter(conversation.messages[messageId].content)}
          </div>
        {/each}
        <!--{@html mdFormatter(chatResult)}-->
      </div>
      <div class="chat-input">
        <input type="text" placeholder="Type your message..." bind:value={prompt} />
        <button onclick={() => {handleNewMessage()}}>Send</button>
        <button onclick={() => conversation.id = null}>Reset</button>
      </div>
    </div>
  </div>
</div>
