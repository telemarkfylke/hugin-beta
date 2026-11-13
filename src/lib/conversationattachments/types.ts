/**
 * Conversation attachments stored in S3 (S3_HUGIN_BUCKET) instead of inline in the message.
 *
 * A stored message keeps only an AttachmentRef next to an empty fileUrl/imageUrl. Everything needed to
 * read the file back - including the per-file key - lives in the conversation header's attachment list
 * (one ConversationAttachmentEntry per stored file), which is encrypted like the rest of the header.
 */

/** What a stored message holds instead of the data URL. */
export type AttachmentRef = {
	// SHA-256 of the original data URL - the same value attachmentId() gives for the inline form, so
	// arming/listing/dedup treat both forms of one file as the same attachment
	sha256: string
	objectId: string
	// Copied from the header entry so the message alone can be listed and validated without
	// reading the header or S3 - harmless duplicates (the message is encrypted too); the file
	// key deliberately is NOT here, it lives only in the header
	mimeType: string
	size: number
}

/** One stored file, as kept (encrypted) in the conversation header. */
export type ConversationAttachmentEntry = {
	sha256: string
	// Random id, used as the last part of the S3 key - never the sha256, so two writes of the same file can never overwrite each other
	objectId: string
	mimeType: string
	// Decoded size in bytes, before encryption
	size: number
	fileName?: string
	// Base64 of the random 32-byte AES key this one file is encrypted with in S3
	fileKey: string
	createdAt: string
}
