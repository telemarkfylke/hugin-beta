import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { getConversationManager } from "$lib/conversationstore/server/get-conversation-manager"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Only these are served inline (shown as <img> in the chat) - everything else, PDFs included, is a
// download, so no stored file can ever be rendered as a document on Hugin's own origin
const INLINE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])

const OBJECT_ID_PATTERN = /^[0-9a-f]{32}$/
// Mongo ObjectId (24 hex) in real use; the mock store uses short numeric ids
const CONVERSATION_ID_PATTERN = /^[0-9a-zA-Z]{1,64}$/

const contentDisposition = (fileName: string): string => {
	const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
	return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/** A stored conversation attachment, decrypted - only for the conversation's owner. */
const getConversationAttachment: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}
	const { conversationId, objectId } = requestEvent.params
	if (!conversationId || !objectId || !CONVERSATION_ID_PATTERN.test(conversationId) || !OBJECT_ID_PATTERN.test(objectId)) {
		throw new HTTPError(404, "Attachment not found")
	}

	let stored: Awaited<ReturnType<ReturnType<typeof getConversationManager>["readStoredAttachment"]>>
	try {
		stored = await getConversationManager().readStoredAttachment(conversationId, objectId, user)
	} catch (error) {
		logger.errorException(error, `Failed to read attachment ${objectId} of conversation ${conversationId}`)
		throw new HTTPError(404, "Attachment not found")
	}
	// Same answer for "not yours" and "doesn't exist", so ids can't be probed
	if (!stored) {
		throw new HTTPError(404, "Attachment not found")
	}

	const { entry, bytes } = stored
	const inline = INLINE_IMAGE_TYPES.has(entry.mimeType)
	const headers = new Headers({
		"Content-Type": inline ? entry.mimeType : "application/octet-stream",
		"Content-Length": String(bytes.byteLength),
		"Cache-Control": "private, no-store",
		"X-Content-Type-Options": "nosniff",
		"Content-Security-Policy": "default-src 'none'; sandbox"
	})
	if (!inline) {
		headers.set("Content-Disposition", contentDisposition(entry.fileName ?? "vedlegg"))
	}
	return {
		isAuthorized: true,
		response: new Response(bytes as BodyInit, { status: 200, headers })
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getConversationAttachment)
}
