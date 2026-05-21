import type { Chat, ChatRequest } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"

/**
 * Builds a ChatRequest from the current chat state, a new user message,
 * and runtime options. Does not mutate any state.
 */
export const buildChatRequest = (chat: Chat, userMessage: ChatInputItem, webSearchEnabled: boolean, stream: boolean, store: boolean): ChatRequest => {
	// Flatten history: chat_response items → their outputs, other items → themselves
	const chatInput = chat.history
		.flatMap((chatItem) => {
			if (chatItem.type === "chat_response") {
				return chatItem.outputs
			}
			return chatItem
		})
		.filter((message) => message !== undefined)

	// Build web search tools list
	const webSearchTools: typeof chat.config.tools = webSearchEnabled
		? [{ type: "web_search" }, ...(chat.config.tools?.filter((t) => t.type !== "web_search") ?? [])]
		: chat.config.tools?.filter((t) => t.type !== "web_search")

	return {
		config: {
			...chat.config,
			name: chat.config.name || chat.config.model || "Ukjent navn",
			tools: webSearchTools
		},
		inputs: [...chatInput, userMessage],
		stream,
		store
	}
}
