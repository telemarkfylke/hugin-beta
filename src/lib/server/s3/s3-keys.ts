/**
 * Object keys for the S3 POC (Silo behind https://s3.ki.telemarkfylke.no). Layout:
 *   <keyPrefix>/<userId>/<uploadId>-<fileName>
 * Keys are always built here from trusted data (userId from auth, a server-generated upload id) and a
 * sanitized file name - never from a raw client-supplied name - so a user can't write outside their own prefix.
 */

import { isSafePathSegment } from "$lib/server/transcription/copyparty-paths"

export const MAX_S3_POC_UPLOAD_BYTES = 500 * 1024 * 1024

const MAX_FILE_NAME_LENGTH = 120
const MAX_EXTENSION_LENGTH = 10

/**
 * Reduces a client-supplied file name to a safe, readable key suffix: no path parts, no leading dots,
 * only letters, digits, dot, dash, underscore and space, capped in length with the extension kept.
 * Always returns a non-empty string.
 */
export const sanitizeFileName = (raw: string): string => {
	const lastSegment = raw.split(/[\\/]/).pop() ?? ""
	const cleaned = lastSegment
		.normalize("NFC")
		.replace(/[^\p{L}\p{N}._ -]/gu, "_")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^\.+/, "")
	if (cleaned === "") {
		return "file"
	}
	if (cleaned.length <= MAX_FILE_NAME_LENGTH) {
		return cleaned
	}
	const dot = cleaned.lastIndexOf(".")
	const extension = dot > 0 && cleaned.length - dot <= MAX_EXTENSION_LENGTH ? cleaned.slice(dot) : ""
	return cleaned.slice(0, MAX_FILE_NAME_LENGTH - extension.length) + extension
}

/** `<keyPrefix>/<userId>/` - everything one user owns. Throws if userId can't be used as a single path segment. */
export const userKeyPrefix = (keyPrefix: string, userId: string): string => {
	if (!isSafePathSegment(userId)) {
		throw new Error("Cannot build an S3 key for this user id")
	}
	return `${keyPrefix}/${userId}/`
}

export const buildObjectKey = (keyPrefix: string, userId: string, uploadId: string, fileName: string): string => {
	if (!isSafePathSegment(uploadId)) {
		throw new Error("Cannot build an S3 key for this upload id")
	}
	return `${userKeyPrefix(keyPrefix, userId)}${uploadId}-${sanitizeFileName(fileName)}`
}
