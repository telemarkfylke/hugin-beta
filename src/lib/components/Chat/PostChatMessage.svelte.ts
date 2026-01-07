import { parseSse } from "$lib/streaming"
import type { ChatConfig, ChatOutputMessage, ChatResponseObject } from "$lib/types/chat"

export const addMessageDeltaToChatItem = (chatResponseObject: ChatResponseObject, itemId: string, messageDelta: string): ChatOutputMessage => {
	if (!chatResponseObject || !chatResponseObject.outputs || !Array.isArray(chatResponseObject.outputs)) {
		throw new Error("No chatResponseObject.outputs to add message delta to")
	}
	if (!itemId) {
		throw new Error("No message ID provided for agent message delta")
	}
	if (!messageDelta) {
		throw new Error("No message delta content provided")
	}
  let outputMessage = chatResponseObject.outputs.find(output => output.type === "message" && output.id === itemId) as ChatOutputMessage | undefined
  if (!outputMessage) {
    outputMessage = {
      id: itemId,
      type: "message",
      role: "assistant",
      status: "in_progress", // Hvordan håndtere status her egentlig?
      content: [
        {
          type: "output_text",
          text: "",
          annotations: []
        }
      ]
    }
    chatResponseObject.outputs.push(outputMessage)
  }
	const messageContent = outputMessage.content[0] // Since we create it ourselves above, it's the first one (for now at least...)
	if (!messageContent || messageContent.type !== "output_text") {
		throw new Error("Agent message content is not of type output_text - what? Devs messed up")
	}
  // console.log("Adding message delta to output message ID:", itemId, "Delta:", messageDelta)
	messageContent.text += messageDelta
	return outputMessage
}

export const postChatMessage = async (chatConfig: ChatConfig, chatResponseObject: ChatResponseObject) => {
	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(chatConfig)
		})
		if (!response.ok) {
			console.error(`Error posting chat message: ${response.statusText}`)
			const errorData = await response.json()
			console.error("Error details:", errorData)
			throw new Error(`Error posting chat message: ${response.statusText}`) // For now, just throw an error
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
				while (true) {
					const { value, done } = await reader.read()
					const chatResponseText = decoder.decode(value, { stream: true })
					const chatResponse = parseSse(chatResponseText)
					for (const chatResult of chatResponse) {
						switch (chatResult.event) {
              case "conversation.created": {
                console.log("Conversation created with ID:", chatResult.data.conversationId)
                chatConfig.conversationId = chatResult.data.conversationId // Trolig ikke greit i følge svelte... siden vi endrer state i en annet scope enn den som eier staten
                break
              }
							case "response.started": {
								const { responseId } = chatResult.data
								console.log("Response started with ID:", chatResult.data.responseId)
                chatResponseObject.id = responseId
                chatResponseObject.status = "in_progress"
								break
							}
							case "response.output_text.delta": {
                console.log("Received message delta for item ID:", chatResult.data.content)
								addMessageDeltaToChatItem(chatResponseObject, chatResult.data.itemId, chatResult.data.content)
								break
							}
							case "response.done": {
								console.log("Response done. Total tokens used:", chatResult.data.usage.totalTokens)
								chatResponseObject.status = "completed"
                chatResponseObject.outputs.forEach(output => {
                  if (output.type === "message") {
                    output.status = "completed"
                  }
                })
                chatResponseObject.usage = chatResult.data.usage
                break
              }
              case "response.error": {
                console.error("Response error:", chatResult.data.code, chatResult.data.message)
                addMessageDeltaToChatItem(chatResponseObject, `error_${Date.now()}`, `\n\n[Error: ${chatResult.data.message}]`)
                chatResponseObject.status = "failed"
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
				addMessageDeltaToChatItem(chatResponseObject, `error_${Date.now()}`, "\n\n[Error occurred while receiving agent response]")
				chatResponseObject.status = "failed"
				throw error
			}
			return
		}
		// Handle non-streaming response
		const responseData: ChatResponseObject = await response.json()
    Object.assign(chatResponseObject, responseData)
		return
	} catch (error) {
		console.error("Error in postChatMessage:", error)
		throw error
	}
}
