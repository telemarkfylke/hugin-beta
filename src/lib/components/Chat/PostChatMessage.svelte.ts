import { parseSse } from "$lib/streaming";
import type { ChatConfig, ChatOutputMessage, ChatResponseObject } from "$lib/types/chat";
import type { ChatItems } from "./types";

export const addMessageDeltaToChatItem = (chatItems: ChatItems, messageId: string, messageDelta: string): ChatOutputMessage => {
  if (!chatItems) {
    throw new Error("No chat items to add message delta to")
  }
  if (!messageId) {
    throw new Error("No message ID provided for agent message delta")
  }
  if (!messageDelta) {
    throw new Error("No message delta content provided")
  }
  const outputMessage: ChatOutputMessage = chatItems[messageId] as ChatOutputMessage || {
    id: messageId,
    type: "message",
    role: "assistant",
    status: "in_progress",
    content: [
      {
        type: "output_text",
        text: ""
      }
    ]
  }
  if (!chatItems[messageId]) {
    chatItems[messageId] = outputMessage
  }
  const messageContent = outputMessage.content[0] // Since we create it ourselves above, it's the first one
  if (!messageContent || messageContent.type !== "output_text") {
    throw new Error("Agent message content is not of type output_text - what? Devs messed up")
  }
  messageContent.text += messageDelta
  return outputMessage
}

export const postChatMessage = async (chatConfig: ChatConfig, chatItems: ChatItems) => {
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(chatConfig)
    });
    if (!response.ok) {
      console.error(`Error posting chat message: ${response.statusText}`);
      const errorData = await response.json();
      console.error("Error details:", errorData);
      throw new Error(`Error posting chat message: ${response.statusText}`); // For now, just throw an error
    }
    if (chatConfig.stream) {
      if (!response.body) {
		    throw new Error("Failed to get a response body from agent prompt")
      }
      if (!response.body.getReader) {
        throw new Error("Response body does not support streaming")
      }
      try {
        const reader = response.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let outputMessage: ChatOutputMessage | null = null
        while (true) {
          const { value, done } = await reader.read()
          const chatResponseText = decoder.decode(value, { stream: true })
          const chatResponse = parseSse(chatResponseText)
          for (const chatResult of chatResponse) {
            switch (chatResult.event) {
              case "conversation.started": {
                const { conversationId } = chatResult.data
                console.log("Conversation started with ID:", conversationId)
                break
              }
              case "conversation.message.delta": {
                const { messageId, content } = chatResult.data
                outputMessage = addMessageDeltaToChatItem(chatItems, messageId, content)
                break
              }
              case "conversation.message.ended": {
                console.log("Conversation message ended. Total tokens used:", chatResult.data.totalTokens)
                if (outputMessage) {
                  outputMessage.status = "completed"
                }
                break
              }
              default: {
                console.warn("Unhandled chat result event:", chatResult.event)
                break
              }
            }
          }
          if (done) break
        }
      } catch (error) {
        const outputMessage = addMessageDeltaToChatItem(chatItems, `error_${Date.now()}`, "\n\n[Error occurred while receiving agent response]")
        outputMessage.status = "incomplete"
        throw error
      }
      return;
    }
    // Handle non-streaming response
    const responseData: ChatResponseObject = await response.json();
    for (const outputItem of responseData.outputs) {
      if (outputItem.type === "message") {
        chatItems[outputItem.id] = outputItem as ChatOutputMessage;
        continue
      }
      chatItems[`output_${outputItem.id}`] = {
        type: "unknown",
        data: outputItem
      }
    }
    return;
  } catch (error) {
    console.error("Error in postChatMessage:", error);
    throw error;
  }
} 


