import type { ChatHistory, ChatHistoryItem } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessageContent } from "$lib/types/chat-item"

// Toggle for stripAttachmentsExceptLatest below - false sends every earlier attachment to the vendor
// again on every turn (the old, expensive behaviour)
const STRIP_OLD_ATTACHMENTS = true

const strippedAttachmentNote = (content: ChatInputMessageContent): ChatInputMessageContent => {
	const name = content.type === "input_file" ? `«${content.fileName}»` : "(bilde)"
	return {
		type: "input_text",
		text: `[Vedlegg ${name} ble lagt ved tidligere i samtalen, men er ikke lenger tilgjengelig for deg. Trenger du innholdet, be brukeren laste det opp på nytt.]`
	}
}

/**
 * Keeps file/image attachments only on the LAST user message and replaces every earlier one with a
 * short text note. Every turn re-sends the whole conversation to the vendor, so an attachment left
 * in history is billed as input again on every following turn (and once per round in the agentic
 * tool loop) - a long conversation with a few large PDFs is what turned into a 20 000 kr night on
 * gpt-6-sol. Deliberate trade-off: a follow-up question about an earlier file no longer sees the
 * file itself, only the assistant's earlier answers about it - the note lets the model ask for a
 * re-upload instead of pretending it still has it.
 */
export const stripAttachmentsExceptLatest = (inputs: ChatInputItem[]): ChatInputItem[] => {
	if (!STRIP_OLD_ATTACHMENTS) {
		return inputs
	}
	const lastUserIndex = inputs.findLastIndex((item) => item.type === "message.input" && item.role === "user")
	return inputs.map((item, index) => {
		if (index === lastUserIndex || item.type !== "message.input" || !item.content.some((c) => c.type !== "input_text")) {
			return item
		}
		return { ...item, content: item.content.map((c) => (c.type === "input_text" ? c : strippedAttachmentNote(c))) }
	})
}

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
