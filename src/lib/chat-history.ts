import type { ChatHistory, ChatHistoryItem } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"

/**
 * Flattens a chat history (ChatInputItem | ChatResponseObject) into the flat ChatInputItem[]
 * shape a vendor request expects - a past assistant response's outputs are valid ChatInputItem
 * on their own (ChatOutputMessage), so they're spread in inline instead of nested under the
 * original response object.
 *
 * A "failed" response is dropped entirely rather than having its outputs spread in: it only ever
 * contains the synthetic "[Error occurred...]" placeholder from addMessageDeltaToChatItem, tagged
 * with a fabricated id (`error_<timestamp>`) that isn't a real vendor item id. Replaying that as
 * prior assistant context makes vendors (e.g. OpenAI, which round-trips output item ids) reject
 * every subsequent request in the conversation - permanently, since incognito mode resends this
 * same history each time. Dropping it here means a failed turn is retryable instead of poisoning
 * the rest of the conversation.
 *
 * Shared between the client (incognito path, which still sends the whole history itself) and
 * the server (stored conversations, which rebuild context from Mongo) so both stay in sync.
 */
export const chatHistoryToInputItems = (history: ChatHistory): ChatInputItem[] => {
	return history
		.flatMap((chatItem: ChatHistoryItem) => {
			if (chatItem.type === "chat_response") {
				return chatItem.status === "failed" ? [] : chatItem.outputs
			}
			return chatItem
		})
		.filter((message): message is ChatInputItem => message !== undefined)
}
