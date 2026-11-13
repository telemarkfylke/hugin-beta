import { logger } from "@vestfoldfylke/loglady"
import { isUnresolvedAttachment } from "$lib/chat-history"
import type { IConversationStore } from "$lib/conversationstore/server/adapters/interface"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatInputItem, ChatInputMessageContent } from "$lib/types/chat-item"
import type { ConversationAttachmentEntry } from "../types"
import type { IAttachmentBlobStore } from "./adapters/interface"
import { attachmentAad, decryptAttachment } from "./attachment-crypto"
import { conversationAttachmentKey } from "./attachment-keys"

type Stores = { conversationStore: IConversationStore; blobStore: IAttachmentBlobStore }

/**
 * One stored attachment's entry and decrypted bytes, or null if it doesn't exist for this principal
 * (not their conversation, unknown object, missing in S3) or can't be decrypted.
 * The owner check is the header lookup itself: getConversationAttachments only returns entries of a
 * conversation the principal owns, and the S3 key is built from principal.userId.
 */
export const readStoredAttachment = async (
	{ conversationStore, blobStore }: Stores,
	conversationId: string,
	objectId: string,
	principal: AuthenticatedPrincipal,
	entries?: ConversationAttachmentEntry[]
): Promise<{ entry: ConversationAttachmentEntry; bytes: Uint8Array } | null> => {
	const entry = (entries ?? (await conversationStore.getConversationAttachments(conversationId, principal))).find((e) => e.objectId === objectId)
	if (!entry) {
		return null
	}
	const ciphertext = await blobStore.get(conversationAttachmentKey(principal.userId, conversationId, objectId))
	if (!ciphertext) {
		logger.warn(`Attachment ${objectId} of conversation ${conversationId} is in the header but missing in storage`)
		return null
	}
	return { entry, bytes: decryptAttachment(ciphertext, entry.fileKey, attachmentAad(principal.userId, conversationId, objectId)) }
}

/**
 * Puts the bytes of stored attachments back into the messages, as data URLs, right before the vendor
 * call. Run it AFTER the unarmed attachments have been stripped, so only what is actually sent is
 * read from storage. An attachment that can't be loaded (or has no conversation to look it up in) is
 * left unresolved - the vendor mappings then send a short note instead (withUnresolvedAttachmentsAsNotes).
 */
export const loadStoredAttachments = async (stores: Stores, inputs: ChatInputItem[], conversationId: string | undefined, principal: AuthenticatedPrincipal): Promise<ChatInputItem[]> => {
	const needsLoading = inputs.some((item) => item.type === "message.input" && item.content.some(isUnresolvedAttachment))
	if (!needsLoading || !conversationId) {
		return inputs
	}
	const entries = await stores.conversationStore.getConversationAttachments(conversationId, principal)

	const loadPart = async (part: ChatInputMessageContent): Promise<ChatInputMessageContent> => {
		if ((part.type !== "input_file" && part.type !== "input_image") || !isUnresolvedAttachment(part) || !part.ref) {
			return part
		}
		try {
			const stored = await readStoredAttachment(stores, conversationId, part.ref.objectId, principal, entries)
			// sha256 must match too - a ref can only resolve to the very file it was created for
			if (!stored || stored.entry.sha256 !== part.ref.sha256) {
				return part
			}
			const dataUrl = `data:${stored.entry.mimeType};base64,${Buffer.from(stored.bytes).toString("base64")}`
			return part.type === "input_file" ? { ...part, fileUrl: dataUrl } : { ...part, imageUrl: dataUrl }
		} catch (error) {
			logger.errorException(error, `Failed to load attachment ${part.ref.objectId} of conversation ${conversationId} - sending a note instead`)
			return part
		}
	}

	return Promise.all(
		inputs.map(async (item) => (item.type === "message.input" && item.content.some(isUnresolvedAttachment) ? { ...item, content: await Promise.all(item.content.map(loadPart)) } : item))
	)
}
