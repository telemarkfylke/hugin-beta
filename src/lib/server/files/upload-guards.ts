import { HTTPError } from "$lib/server/middleware/http-error"

/**
 * A single path segment: non-empty, max 255 chars, no separators, not "." or "..". Used for every
 * client-influenced part of a storage key, so a user can never reach outside their own prefix.
 */
export const isSafePathSegment = (value: string): boolean => {
	return value.length > 0 && value.length <= 255 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\")
}

/** Passes the body through unchanged, but errors the stream once more than maxBytes have gone by. */
export const limitBytes = (maxBytes: number): TransformStream<Uint8Array, Uint8Array> => {
	let total = 0
	return new TransformStream({
		transform(chunk, controller) {
			total += chunk.byteLength
			if (total > maxBytes) {
				controller.error(new HTTPError(413, "File is too large"))
				return
			}
			controller.enqueue(chunk)
		}
	})
}
