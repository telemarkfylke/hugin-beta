import type { RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { canUseTranscription } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { resolveUrlUnderBase } from "$lib/server/transcription/copyparty-paths"
import { getJobById } from "$lib/server/transcription/job-store"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const sanitizeFileName = (name: string): string => {
	const base = name.replace(/\.[^.]+$/, "") || "transkripsjon"
	return base.replace(/[^\w\-. ]+/g, "_")
}

const downloadDocx: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) {
		return { isAuthorized: false, response: new Response(null, { status: 403 }) }
	}
	const id = requestEvent.params.id
	if (!id) {
		throw new HTTPError(400, "Missing job id")
	}

	const job = getJobById(user.userId, id)
	if (!job) {
		throw new HTTPError(404, "Transkripsjonen ble ikke funnet")
	}
	if (job.status !== "completed" || !job.result?.docx_url) {
		throw new HTTPError(404, "Transkripsjonen har ingen nedlastbar fil")
	}

	// Guard against SSRF — only fetch from inside the configured Copyparty base URL, and fail closed without it
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")
	const docxUrl = resolveUrlUnderBase(copypartyBase, job.result.docx_url)
	if (!docxUrl) {
		throw new HTTPError(502, "Ugyldig dokument-URL")
	}

	let upstream: Response
	try {
		upstream = await fetch(docxUrl.href, { redirect: "error" })
	} catch (error) {
		logger.errorException(error, "[Transcription Download] - Failed to fetch docx for job {jobId}", job.id)
		throw new HTTPError(502, "Kunne ikke hente dokument")
	}
	if (!upstream.ok || !upstream.body) {
		throw new HTTPError(502, `Kunne ikke hente dokument (${upstream.status})`)
	}

	const fileName = `${sanitizeFileName(job.fileName)}.docx`
	const response = new Response(upstream.body, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": `attachment; filename="${fileName}"`
		}
	})
	return { isAuthorized: true, response }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, downloadDocx)
