import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { applyCallback } from "$lib/server/transcription/job-store"
import { TranscriptionCallbackSchema } from "$lib/server/transcription/types"

export const POST: RequestHandler = async ({ request, url }) => {
	const secret = env.TRANSCRIPTION_CALLBACK_SECRET
	if (secret && url.searchParams.get("secret") !== secret) {
		return json({ message: "Unauthorized" }, { status: 401 })
	}
	let body: unknown
	try {
		body = await request.json()
	} catch (error) {
		logger.errorException(error, "[Transcription Callback] - Failed to parse JSON body")
		return json({ message: "Invalid JSON" }, { status: 400 })
	}

	const parsed = TranscriptionCallbackSchema.safeParse(body)
	if (!parsed.success) {
		logger.warn("[Transcription Callback] - Invalid payload: {issues}", JSON.stringify(parsed.error.issues))
		return json({ message: "Invalid payload", issues: parsed.error.issues }, { status: 400 })
	}

	const job = applyCallback(parsed.data)
	logger.info("[Transcription Callback] - Applied job {jobId} for {upn} with status {status}", parsed.data.job_id, parsed.data.upn, parsed.data.status)

	return json({ ok: true, localJobId: job?.id }, { status: 200 })
}
