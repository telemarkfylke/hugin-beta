import { logger } from "@vestfoldfylke/loglady"
import { attachmentId } from "$lib/chat-history"
import type { IConversationStore } from "$lib/conversationstore/server/adapters/interface"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatInputItem, ChatInputMessageContent } from "$lib/types/chat-item"
import type { ConversationAttachmentEntry } from "../types"
import type { IAttachmentBlobStore } from "./adapters/interface"
import { attachmentAad, encryptAttachment, newAttachmentObjectId } from "./attachment-crypto"
import { conversationAttachmentKey } from "./attachment-keys"
import { parseBase64DataUrl } from "./data-url"

type StoreAttachmentsParams = {
	userInput: ChatInputItem
	conversationId: string
	principal: AuthenticatedPrincipal
	conversationStore: IConversationStore
	blobStore: IAttachmentBlobStore
}

const notStoredNote = (part: ChatInputMessageContent): ChatInputMessageContent => {
	const name = part.type === "input_file" ? `«${part.fileName}»` : "(bilde)"
	return { type: "input_text", text: `[Vedlegg ${name} kunne ikke lagres.]` }
}

/**
 * Moves the base64 attachments of one user message out of the message and into storage, returning the
 * message to persist instead: each data URL is replaced by an empty string plus a ref (see InputFile).
 *
 * Per file: encrypt under a fresh key → put in S3 → append its entry (with the key) to the conversation
 * header → only then reference it from the message. A crash in between leaves at most an unreferenced
 * header entry/object under the conversation's prefix, which is deleted with the conversation - never a
 * message pointing at a file that doesn't exist. A file already stored in this conversation (same
 * sha256 in the header) is reused, not stored again.
 *
 * A file that can't be stored is replaced by a short note rather than failing the whole message: the
 * pair (question + answer) is still saved, which is what used to be lost when an inline attachment
 * pushed the document past Mongo's 16 MB limit.
 */
export const moveAttachmentsToStorage = async ({ userInput, conversationId, principal, conversationStore, blobStore }: StoreAttachmentsParams): Promise<ChatInputItem> => {
	if (userInput.type !== "message.input") {
		return userInput
	}
	const hasInline = userInput.content.some((part) => (part.type === "input_file" ? part.fileUrl : part.type === "input_image" ? part.imageUrl : "").startsWith("data:"))
	if (!hasInline) {
		return userInput
	}

	let known: Map<string, ConversationAttachmentEntry> | null = null
	const content: ChatInputMessageContent[] = []
	for (const part of userInput.content) {
		if (part.type !== "input_file" && part.type !== "input_image") {
			content.push(part)
			continue
		}
		const parsed = parseBase64DataUrl(part.type === "input_file" ? part.fileUrl : part.imageUrl)
		if (!parsed) {
			content.push(part)
			continue
		}
		try {
			const sha256 = await attachmentId(part)
			known ??= new Map((await conversationStore.getConversationAttachments(conversationId, principal)).map((entry) => [entry.sha256, entry]))
			let entry = known.get(sha256)
			if (!entry) {
				const objectId = newAttachmentObjectId()
				const { ciphertext, fileKey } = encryptAttachment(parsed.bytes, attachmentAad(principal.userId, conversationId, objectId))
				await blobStore.put(conversationAttachmentKey(principal.userId, conversationId, objectId), ciphertext)
				entry = {
					sha256,
					objectId,
					mimeType: parsed.mimeType,
					size: parsed.bytes.byteLength,
					...(part.type === "input_file" && { fileName: part.fileName }),
					fileKey,
					createdAt: new Date().toISOString()
				}
				await conversationStore.addConversationAttachment(conversationId, entry, principal)
				known.set(sha256, entry)
			}
			const ref = { sha256, objectId: entry.objectId, mimeType: entry.mimeType, size: entry.size }
			content.push(part.type === "input_file" ? { type: "input_file", fileName: part.fileName, fileUrl: "", ref } : { type: "input_image", imageUrl: "", ref })
		} catch (error) {
			logger.errorException(error, "Failed to store an attachment of conversation {conversationId} - saving the message without it", conversationId)
			content.push(notStoredNote(part))
		}
	}
	return { ...userInput, content }
}
