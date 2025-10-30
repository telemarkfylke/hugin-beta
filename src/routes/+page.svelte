<script>
  import { markdownFormatter } from "$lib/formatting/markdown-formatter.js";

  // Page state
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

  const askMistral = async (restartFromMessageId) => {
    const payload = {
      prompt,
      conversationId: conversation.id, // Use existing conversation ID if available
      messageId: restartFromMessageId || undefined // Use provided message ID or undefined
    }
    // const response = await fetch("https://azure-func-test.api.vestfoldfylke.no/api/Strim", { method: "POST", body: JSON.stringify({ ...payload }) })
    const response = await fetch("/api/mistral", { method: "POST", body: JSON.stringify(payload) })

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
  }
</script>

<main>
  <div>
  <h1>Mistral da</h1>

  <div id="chat">
    <div class="chat-container">
      <div class="chat-header">
        <h2>Mistral Chat</h2>
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
        <button onclick={() => askMistral()}>Send</button>
      </div>
    </div>
  </div>
</div>
</main>