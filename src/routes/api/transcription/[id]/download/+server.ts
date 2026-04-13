import type { RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { getJobById } from "$lib/server/transcription/job-store"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const sanitizeFileName = (name: string): string => {
	const base = name.replace(/\.[^.]+$/, "") || "transkripsjon"
	return base.replace(/[^\w\-. ]+/g, "_")
}

const downloadDocx: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.preferredUserName) {
		throw new HTTPError(400, "preferredUserName is required")
	}
	const id = requestEvent.params.id
	if (!id) {
		throw new HTTPError(400, "Missing job id")
	}

	const job = getJobById(user.preferredUserName, id)
	if (!job) {
		throw new HTTPError(404, "Transkripsjonen ble ikke funnet")
	}
	if (job.status !== "completed" || !job.result?.docx_url) {
		throw new HTTPError(404, "Transkripsjonen har ingen nedlastbar fil")
	}

	let upstream: Response
	try {
		upstream = await fetch(job.result.docx_url)
	} catch (error) {
		throw new HTTPError(502, `Kunne ikke hente dokument: ${(error as Error).message}`)
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
