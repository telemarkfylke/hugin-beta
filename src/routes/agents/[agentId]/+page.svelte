<script>
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";
  import { page } from "$app/state";
  import { parseSse } from "$lib/streaming.js";
  import { z } from "zod";
  
  // Internal types
  /** @typedef {z.infer<typeof FrontendConversationMessage>} */
  const FrontendConversationMessage = z.object({
    type: z.enum(['user', 'agent']),
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

  // Methods for handling conversation
  const resetConversation = () => {
    conversation.id = null
    conversation.messages = {}
    prompt = ''
  };

  /**
   * Create a new conversation
   * @param {string} userPrompt
   * @return {Promise<Response>}
   */
  const createConversation = async (userPrompt) => {
    return await fetch(`/api/agents/${agentId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ prompt: userPrompt, stream: true })
    });
  };

  /**
   * Append message to existing conversation
   * @param {string} userPrompt
   * @return {Promise<Response>}
   */
  const appendMessageToConversation = async (userPrompt) => {
    return await fetch(`/api/agents/${agentId}/conversations/${conversation.id}`, {
      method: "POST",
      body: JSON.stringify({ prompt: userPrompt, stream: true })
    });
  };

  /**
   * Add user message to conversation
   * @param {string} userPrompt
   * @return {string} userPrompt
   */
  const addUserMessageToConversation = (userPrompt) => {
    const messageId = `user-${Date.now()}`; // Simple unique ID based on timestamp
    conversation.messages[messageId] = {
      type: 'user',
      content: userPrompt
    };
    prompt = ''; // Clear input prompt in local state (hmm, might be better to do this outside function to keep function pure?)
    return userPrompt
  };

  /**
   * Handle new message event
   * @param {Event} event
   */
  const handleNewMessage = async (event) => {
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
        console.log("Chat response text:", chatResponseText)
        const chatResponse = parseSse(chatResponseText)
        for (const chatResult of chatResponse) {
          console.log("Chat result:", chatResult)
          const { conversationId, messageId, content } = chatResult.data
          if (conversationId && conversation.id !== conversationId) { // New conversation
            conversation.id = conversationId
          }
          if (messageId) { // New message or append to existing message
            if (!conversation.messages[messageId]) {
              conversation.messages[messageId] = { type: 'agent', content: '' }
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

<div>
  <h1>{agentId}</h1>

  <div id="chat">
    <div class="chat-container">
      <div class="chat-messages">
        {#each Object.keys(conversation.messages) as messageId}
          {console.log('Rendering message:', conversation.messages[messageId])}
          <div class="chat-message">
            {@html markdownFormatter(conversation.messages[messageId].content)}
          </div>
        {/each}
        <!--{@html mdFormatter(chatResult)}-->
      </div>
      <div class="chat-input">
        <form onsubmit={handleNewMessage}>
          <input type="text" placeholder="Type your message..." bind:value={prompt} />
          <button type="submit">Send</button>
        </form>
        <button onclick={resetConversation}>Reset</button>
      </div>
    </div>
  </div>
</div>
