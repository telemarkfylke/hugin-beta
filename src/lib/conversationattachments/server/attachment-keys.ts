import { isSafePathSegment } from "$lib/server/files/upload-guards"

/**
 * S3 keys for conversation attachments, in the shared Hugin bucket (S3_HUGIN_BUCKET):
 *   conversation-attachments/<userId>/<conversationId>/<objectId>
 * Built only from trusted values: userId from auth, conversationId after the ownership check, and a
 * server-generated objectId. Deleting a conversation deletes its whole prefix.
 */
const KEY_PREFIX = "conversation-attachments"

const assertSafe = (value: string, what: string): void => {
	if (!isSafePathSegment(value)) {
		throw new Error(`Cannot build an attachment key from this ${what}`)
	}
}

/** Everything stored for one conversation - deleted together with it. */
export const conversationAttachmentPrefix = (userId: string, conversationId: string): string => {
	assertSafe(userId, "user id")
	assertSafe(conversationId, "conversation id")
	return `${KEY_PREFIX}/${userId}/${conversationId}/`
}

export const conversationAttachmentKey = (userId: string, conversationId: string, objectId: string): string => {
	assertSafe(objectId, "object id")
	return `${conversationAttachmentPrefix(userId, conversationId)}${objectId}`
}
