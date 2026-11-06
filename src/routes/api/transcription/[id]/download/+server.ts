import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { hasFeature } from "$lib/featureflags/server/feature-access"
import { isSafePathSegment } from "$lib/server/files/upload-guards"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { getJobById } from "$lib/server/transcription/job-store"
import { requireTranscriptionStorage } from "$lib/server/transcription/require-storage"
import { getDocx } from "$lib/server/transcription/transcription-storage"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

/** "Møte med Ola.mp3" -> the download name, as an ASCII fallback plus the real UTF-8 name (RFC 6266). */
const contentDisposition = (sourceName: string): string => {
	const base = sourceName.replace(/\.[^.]+$/, "").trim() || "transkripsjon"
	const asciiFallback = base.replace(/[^\w\-. ]+/g, "_")
	return `attachment; filename="${asciiFallback}.docx"; filename*=UTF-8''${encodeURIComponent(`${base}.docx`)}`
}

const downloadDocx: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!(await hasFeature(user, "transcription"))) {
		return { isAuthorized: false, response: new Response(null, { status: 403 }) }
	}
	const storage = requireTranscriptionStorage()
	const id = requestEvent.params.id
	if (!id || !isSafePathSegment(id)) {
		throw new HTTPError(400, "Invalid job id")
	}

	// Looked up by the caller's own <userId>/<id>/ prefix, so it also works after a restart has emptied the job store
	let docx: Awaited<ReturnType<typeof getDocx>>
	try {
		docx = await getDocx(storage, { userId: user.userId, jobId: id })
	} catch (error) {
		logger.errorException(error, "[Transcription Download] - Failed to read docx for job {jobId}", id)
		throw new HTTPError(502, "Kunne ikke hente dokumentet")
	}
	if (!docx) {
		throw new HTTPError(404, "Transkripsjonen har ingen nedlastbar fil")
	}

	const sourceName = getJobById(user.userId, id)?.fileName ?? docx.originalName ?? "transkripsjon"
	const response = new Response(docx.body, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": contentDisposition(sourceName)
		}
	})
	return { isAuthorized: true, response }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, downloadDocx)
