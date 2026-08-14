import { invalidateAll } from "$app/navigation"
import { addMessageDeltaToChatItem, applyChatSseEventToResponseObject } from "$lib/chat-response-builder"
import { parseSse } from "$lib/streaming"
import type { Chat, ChatRequest, ChatResponseObject } from "$lib/types/chat"

export const postChatMessage = async (chatRequest: ChatRequest, chatResponseObject: ChatResponseObject, chat: Chat, endpoint: string = "/api/chat") => {
	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(chatRequest)
		})
		if (!response.ok) {
			console.error(`Error posting chat message: ${response.statusText}`)
			if (response.status === 401) {
				// Session expired — re-run server loads via SvelteKit. The layout load will
				// throw svelteError(401) if the session is truly gone, showing the login screen.
				chatResponseObject.status = "failed"
				await invalidateAll()
				return
			}
			if (response.status === 403) {
				// Not authorized for this specific agent — this is not a session issue.
				// Show the error in the chat UI; redirecting to "/" would just loop.
				addMessageDeltaToChatItem(chatResponseObject, `error_${Date.now()}`, "Du har ikke tilgang til å bruke denne agenten.")
				chatResponseObject.status = "failed"
				return
			}
			const errorData = await response.json().catch(() => null)
			console.error("Error details:", errorData)
			throw new Error(`Error posting chat message: ${response.statusText}`)
		}
		if (chatRequest.stream) {
			if (!response.body) {
				throw new Error("Failed to get a response body from agent prompt")
			}
			if (!response.body.getReader) {
				throw new Error("Response body does not support streaming")
			}
			const reader = response.body.getReader()
			const decoder = new TextDecoder("utf-8")
			while (true) {
				const { value, done } = await reader.read()
				const chatResponseText = decoder.decode(value, { stream: true })
				const chatResponse = parseSse(chatResponseText)
				for (const chatResult of chatResponse) {
					switch (chatResult.event) {
						case "conversation.created": {
							chat.config.conversationId = chatResult.data.conversationId // Trolig ikke greit i følge svelte... siden vi endrer state i en annet scope enn den som eier staten
							break
						}
						case "hugin_conversation.created": {
							chat._id = chatResult.data.huginConversationId // Samme som over - endrer state utenfor eierscopet
							break
						}
						default: {
							applyChatSseEventToResponseObject(chatResponseObject, chatResult)
							break
						}
					}
				}
				if (done) break
			}
			return
		}
		// Handle non-streaming response
		const responseData: ChatResponseObject = await response.json()
		Object.assign(chatResponseObject, responseData)
		return
	} catch (error) {
		addMessageDeltaToChatItem(chatResponseObject, `error_${Date.now()}`, "\n\n[Error occurred while receiving agent response]")
		chatResponseObject.status = "failed"
		console.error("Error in postChatMessage:", error)
		throw error
	}
}
