import type { RequestHandler } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import { canUseTranscription } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { buildAudioUrl, hasAcceptedAudioExtension, isSafePathSegment, limitBytes, MAX_UPLOAD_BYTES } from "$lib/server/transcription/copyparty-paths"
import { getJobById } from "$lib/server/transcription/job-store"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const proxyUpload: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) {
		return { isAuthorized: false, response: new Response(null, { status: 403 }) }
	}
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) {
		throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")
	}

	const { request } = requestEvent

	// Extract the three expected segments: <userId>/<jobId>/<filename>
	const suffix = requestEvent.params.path ?? ""
	const firstSlash = suffix.indexOf("/")
	if (firstSlash === -1) {
		throw new HTTPError(400, "Invalid upload path — expected /<userId>/<jobId>/<filename>")
	}
	const secondSlash = suffix.indexOf("/", firstSlash + 1)
	if (secondSlash === -1) {
		throw new HTTPError(400, "Invalid upload path — expected /<userId>/<jobId>/<filename>")
	}

	// Validate userId from URL against the authenticated user — prevents writing to other users' folders
	const userIdFromUrl = decodeURIComponent(suffix.slice(0, firstSlash))
	if (userIdFromUrl !== user.userId) {
		throw new HTTPError(403, "Upload path does not match authenticated user")
	}

	const jobId = decodeURIComponent(suffix.slice(firstSlash + 1, secondSlash))
	const decodedFileName = decodeURIComponent(suffix.slice(secondSlash + 1))
	if (!isSafePathSegment(jobId) || !isSafePathSegment(decodedFileName)) {
		throw new HTTPError(400, "Invalid upload path")
	}
	if (!hasAcceptedAudioExtension(decodedFileName)) {
		throw new HTTPError(400, "File type not allowed")
	}

	// Only upload into a job this user created and has not started yet, under the name it was created with.
	const job = getJobById(user.userId, jobId)
	if (!job || job.status !== "uploading" || job.fileName !== decodedFileName) {
		throw new HTTPError(404, "No upload pending for this job")
	}

	const contentLength = request.headers.get("content-length")
	if (contentLength && Number(contentLength) > MAX_UPLOAD_BYTES) {
		throw new HTTPError(413, "File is too large")
	}
	if (!request.body) {
		throw new HTTPError(400, "Missing file")
	}

	// Reconstruct the target URL from trusted data only (userId from auth, the job's id and filename)
	// Using jobId in the path ensures each upload is unique — Copyparty will never rename/deduplicate it
	const targetUrl = buildAudioUrl(copypartyBase, user.userId, job.id, job.fileName)

	// Forward Content-Length if present so Copyparty gets the size upfront (avoids chunked encoding)
	const headers: Record<string, string> = { "Content-Type": "application/octet-stream" }
	if (contentLength) headers["content-length"] = contentLength

	let upstream: Response
	try {
		upstream = await fetch(targetUrl, {
			method: "PUT",
			// The byte limit also covers requests without (or with a lying) Content-Length
			body: request.body.pipeThrough(limitBytes(MAX_UPLOAD_BYTES)),
			headers,
			// @ts-expect-error — required in Node 18+ to stream request bodies
			duplex: "half"
		})
	} catch (error) {
		// The byte limit errors the body stream; fetch may surface that directly or as the cause
		if (error instanceof HTTPError) throw error
		if (error instanceof Error && error.cause instanceof HTTPError) throw error.cause
		throw new HTTPError(502, "Opplastingen feilet")
	}

	return {
		isAuthorized: true,
		response: new Response(upstream.body, { status: upstream.status })
	}
}

export const PUT: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, proxyUpload)
