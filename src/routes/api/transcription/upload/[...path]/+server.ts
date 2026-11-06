import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { hasFeature } from "$lib/featureflags/server/feature-access"
import { isSafePathSegment, limitBytes } from "$lib/server/files/upload-guards"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { getJobById } from "$lib/server/transcription/job-store"
import { requireTranscriptionStorage } from "$lib/server/transcription/require-storage"
import { hasAcceptedAudioExtension, MAX_UPLOAD_BYTES } from "$lib/server/transcription/transcription-keys"
import { uploadAudio } from "$lib/server/transcription/transcription-storage"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

/** PUT /api/transcription/upload/<userId>/<jobId>/<fileName> with the raw audio as the body - streamed on to S3. */
const uploadHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!(await hasFeature(user, "transcription"))) {
		return { isAuthorized: false, response: new Response(null, { status: 403 }) }
	}
	const storage = requireTranscriptionStorage()

	const { request } = requestEvent

	// Extract the three expected segments: <userId>/<jobId>/<filename>
	const suffix = requestEvent.params.path ?? ""
	const firstSlash = suffix.indexOf("/")
	const secondSlash = firstSlash === -1 ? -1 : suffix.indexOf("/", firstSlash + 1)
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

	try {
		await uploadAudio(storage, {
			userId: user.userId,
			jobId: job.id,
			fileName: job.fileName,
			// The byte limit also covers requests without (or with a lying) Content-Length
			body: request.body.pipeThrough(limitBytes(MAX_UPLOAD_BYTES))
		})
	} catch (error) {
		// The byte limit errors the body stream; the SDK may surface that directly or as the cause
		if (error instanceof HTTPError) throw error
		if (error instanceof Error && error.cause instanceof HTTPError) throw error.cause
		logger.errorException(error, "[Transcription] - Upload to S3 failed for job {jobId}", job.id)
		throw new HTTPError(502, "Opplastingen feilet")
	}

	return { isAuthorized: true, response: new Response(null, { status: 201 }) }
}

export const PUT: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, uploadHandler)
