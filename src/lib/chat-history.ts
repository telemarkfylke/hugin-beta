import type { ChatHistory, ChatHistoryItem } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"

/**
 * Flattens a chat history (ChatInputItem | ChatResponseObject) into the flat ChatInputItem[]
 * shape a vendor request expects - a past assistant response's outputs are valid ChatInputItem
 * on their own (ChatOutputMessage), so they're spread in inline instead of nested under the
 * original response object.
 *
 * Shared between the client (incognito path, which still sends the whole history itself) and
 * the server (stored conversations, which rebuild context from Mongo) so both stay in sync.
 */
export const chatHistoryToInputItems = (history: ChatHistory): ChatInputItem[] => {
	return history
		.flatMap((chatItem: ChatHistoryItem) => {
			if (chatItem.type === "chat_response") {
				return chatItem.outputs
			}
			return chatItem
		})
		.filter((message): message is ChatInputItem => message !== undefined)
}
