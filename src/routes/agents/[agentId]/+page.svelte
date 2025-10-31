<script>
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";
  import { page } from "$app/state";

  // State for current agent chat
  const agentId = page.params.agentId
  let conversationId = null;
  let prompt = ''

  const conversation = {
    id: null, // Conversation ID will be set after the first message
    messages: {} // Store messages as an object with messageId as keys
  }

  /**
   * @description EventSource doesnt support POST requests, so we need to parse the SSE text manually (until some smart person sees this...)
   * @param {string} text
   * @returns {Array} Parsed SSE data as an array of objects
   */
  const parseSse = (text) => {
    if (typeof text !== 'string' && !text) throw new Error("No text (string) provided for parsing SSE")
    const dataLines = text.split('\n\n')
    const result = []
    for (const line of dataLines) {
      if (line.length === 0) continue // Skip empty lines
      if (!(line.startsWith('data: '))) {
        console.log("Invalid line:", line);
        throw new Error("Invalid SSE format - must start with 'data: ' and end with '\\n\\n'")
      }
      const data = line.slice(6).trim() // Remove 'data: ' prefix
      try {
        result.push(JSON.parse(data))
      } catch (error) {
        throw new Error("Failed to parse JSON from SSE data: " + error.message)
      }
    }
    return result
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
      const response = conversation.id
        ? await appendMessageToConversation()
        : await createConversation();
      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      while (true) {
        const { value, done } = await reader.read()
        const chatResponseText = decoder.decode(value, { stream: true })
        const chatResponse = parseSse(chatResponseText)
        for (const chatResult of chatResponse) {
          console.log("Chat result:", chatResult)
          const { conversationId, messageId, content } = chatResult
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
