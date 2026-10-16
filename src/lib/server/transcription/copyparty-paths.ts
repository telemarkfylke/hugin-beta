/**
 * Copyparty URL rules for transcription files. Layout (set by Hugin's upload proxy and by tale-til-notat):
 *   audio: <base>/<userId>/<jobId>/<fileName>
 *   docx:  <base>/<userId>/<name>.docx
 * Everything that deletes or fetches from Copyparty goes through these helpers, so a client can never
 * point the server at another user's folder or at a URL outside the configured base.
 */

import { HTTPError } from "$lib/server/middleware/http-error"

export const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mkv", ".avi", ".wma"]

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

/**
 * A single path segment: non-empty, max 255 chars, no separators, not "." or "..". Segments are
 * URL-encoded when used, so ".." inside a name ("møte..final.mp3") is harmless.
 */
export const isSafePathSegment = (value: string): boolean => {
	return value.length > 0 && value.length <= 255 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\")
}

export const hasAcceptedAudioExtension = (fileName: string): boolean => {
	const lower = fileName.toLowerCase()
	return ACCEPTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export const buildAudioUrl = (base: string, userId: string, jobId: string, fileName: string): string => {
	return `${base}/${encodeURIComponent(userId)}/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`
}

/** Legacy layout for jobs created before uploads were keyed by job id: <base>/<userId>/<fileName> */
export const buildLegacyAudioUrl = (base: string, userId: string, fileName: string): string => {
	return `${base}/${encodeURIComponent(userId)}/${encodeURIComponent(fileName)}`
}

const parseUrl = (value: string): URL | null => {
	try {
		return new URL(value)
	} catch {
		return null
	}
}

const basePathOf = (base: URL): string => base.pathname.replace(/\/+$/, "")

/**
 * Returns the normalised URL if it is strictly inside the Copyparty base (same origin, path below the
 * base path, no query or fragment), otherwise null. Use the returned value, not the input - the URL
 * parser resolves `..` and percent-encoded dots, so checking the raw string is not enough.
 */
export const resolveUrlUnderBase = (base: string, value: string): URL | null => {
	const baseUrl = parseUrl(base)
	const url = parseUrl(value)
	if (!baseUrl || !url) return null
	if (url.origin !== baseUrl.origin || url.search !== "" || url.hash !== "") return null
	if (!url.pathname.startsWith(`${basePathOf(baseUrl)}/`)) return null
	return url
}

/** Returns the normalised URL if it is exactly <base>/<userId>/<name>.docx, otherwise null. */
export const resolveOwnDocxUrl = (base: string, userId: string, value: string): URL | null => {
	const url = resolveUrlUnderBase(base, value)
	if (!url) return null
	const baseUrl = new URL(base)
	const rest = url.pathname.slice(basePathOf(baseUrl).length + 1).split("/")
	if (rest.length !== 2) return null
	const [ownerSegment, fileSegment] = rest as [string, string]
	let owner: string
	let fileName: string
	try {
		owner = decodeURIComponent(ownerSegment)
		fileName = decodeURIComponent(fileSegment)
	} catch {
		return null
	}
	if (owner !== userId) return null
	if (!isSafePathSegment(fileName) || !fileName.toLowerCase().endsWith(".docx")) return null
	return url
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
