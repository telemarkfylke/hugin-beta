import type { ChatHistory, ChatHistoryItem } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessageContent } from "$lib/types/chat-item"
import type { InputFile, InputImage } from "$lib/types/chat-item-content"

// How attachments from EARLIER turns are sent to the vendor (the newest user message always keeps its own):
//   "off"    - every earlier attachment is sent again on every turn (the old, expensive behaviour)
//   "latest" - no earlier attachment is sent
//   "armed"  - only the earlier attachments the user has armed in the file list above the chat input
export type AttachmentStripMode = "off" | "latest" | "armed"
export const ATTACHMENT_STRIP_MODE = "armed" as AttachmentStripMode
// Max attachments sent per turn in "armed" mode - the newest message's own attachments count first
export const MAX_ARMED_ATTACHMENTS = 5

type Attachment = InputFile | InputImage

export type ConversationAttachment = {
	id: string
	kind: "file" | "image"
	name: string
	// Approximate decoded size in bytes (from the base64 length)
	size: number
}

const isAttachment = (content: ChatInputMessageContent): content is Attachment => content.type === "input_file" || content.type === "input_image"

const attachmentUrl = (attachment: Attachment): string => (attachment.type === "input_file" ? attachment.fileUrl : attachment.imageUrl)

const userAttachments = (item: ChatInputItem): Attachment[] => (item.type === "message.input" && item.role === "user" ? item.content.filter(isAttachment) : [])

/**
 * Stable id for an attachment: SHA-256 of its data URL. Content-based rather than positional so the
 * client (which hashes its own chat.history) and the server (which may rebuild history from Mongo)
 * always agree, with no schema change. crypto.subtle exists in both the browser and Node.
 */
export const attachmentId = async (attachment: Attachment): Promise<string> => {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(attachmentUrl(attachment)))
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** Every distinct attachment in the conversation, in the order it first appeared. */
export const listConversationAttachments = async (inputs: ChatInputItem[]): Promise<ConversationAttachment[]> => {
	const result: ConversationAttachment[] = []
	let imageCount = 0
	for (const attachment of inputs.flatMap(userAttachments)) {
		const id = await attachmentId(attachment)
		if (result.some((a) => a.id === id)) {
			continue
		}
		const url = attachmentUrl(attachment)
		const size = Math.round(((url.length - url.indexOf(",") - 1) * 3) / 4)
		if (attachment.type === "input_file") {
			result.push({ id, kind: "file", name: attachment.fileName, size })
		} else {
			imageCount++
			result.push({ id, kind: "image", name: `Bilde ${imageCount}`, size })
		}
	}
	return result
}

const strippedAttachmentNote = (attachment: Attachment): ChatInputMessageContent => {
	const name = attachment.type === "input_file" ? `«${attachment.fileName}»` : "(bilde)"
	const hint = ATTACHMENT_STRIP_MODE === "armed" ? "be brukeren aktivere det i fillisten over chatfeltet" : "be brukeren laste det opp på nytt"
	return {
		type: "input_text",
		text: `[Vedlegg ${name} ble lagt ved tidligere i samtalen, men er ikke aktivt nå og du kan ikke se innholdet. Trenger du det, ${hint}.]`
	}
}

/**
 * Removes attachments from earlier turns before the vendor call, replacing each with a short text
 * note (see ATTACHMENT_STRIP_MODE). Every turn re-sends the whole conversation, so an attachment
 * left in history is billed as input again on every following turn (and once per round in the
 * agentic tool loop) - a long conversation with a few large PDFs is what turned into a 20 000 kr
 * night on gpt-6-sol. The newest user message always keeps its own attachments. In "armed" mode,
 * earlier attachments whose id is in armedIds are kept too, newest first, until
 * MAX_ARMED_ATTACHMENTS is reached - enforced here, since armedIds comes from the client. A file
 * that appears several times in the history is only ever sent once (its newest occurrence).
 */
export const stripUnarmedAttachments = async (inputs: ChatInputItem[], armedIds: string[] = []): Promise<ChatInputItem[]> => {
	if (ATTACHMENT_STRIP_MODE === "off") {
		return inputs
	}
	const armed = new Set(ATTACHMENT_STRIP_MODE === "armed" ? armedIds : [])
	const lastUserIndex = inputs.findLastIndex((item) => item.type === "message.input" && item.role === "user")
	const latest = lastUserIndex === -1 ? [] : userAttachments(inputs[lastUserIndex] as ChatInputItem)
	const sent = new Set(await Promise.all(latest.map(attachmentId)))
	let budget = MAX_ARMED_ATTACHMENTS - sent.size

	const result = [...inputs]
	for (let index = lastUserIndex - 1; index >= 0; index--) {
		const item = result[index] as ChatInputItem
		if (item.type !== "message.input" || !item.content.some(isAttachment)) {
			continue
		}
		const content: ChatInputMessageContent[] = []
		for (const part of item.content) {
			if (!isAttachment(part)) {
				content.push(part)
				continue
			}
			const id = await attachmentId(part)
			if (!sent.has(id) && armed.has(id) && budget > 0) {
				sent.add(id)
				budget--
				content.push(part)
			} else {
				content.push(strippedAttachmentNote(part))
			}
		}
		result[index] = { ...item, content }
	}
	return result
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
