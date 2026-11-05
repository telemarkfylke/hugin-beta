import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { applyCallback, setDocxStored } from "$lib/server/transcription/job-store"
import { buildTranscriptionDocx } from "$lib/server/transcription/transcription-docx"
import { deleteAudio, getTranscriptionStorage, putDocx } from "$lib/server/transcription/transcription-storage"
import { TranscriptionCallbackSchema, type TranscriptionJob } from "$lib/server/transcription/types"

/**
 * After tale-til-notat is done: build the Word document from the returned text and store it in S3, then
 * delete the audio - it is only kept until it has been transcribed. Failures are logged and recorded on the
 * job, but never thrown: the callback is still acknowledged so tale-til-notat doesn't retry it.
 */
const storeResult = async (job: TranscriptionJob, durationSeconds: number | null | undefined): Promise<void> => {
	const storage = getTranscriptionStorage()
	if (!storage) {
		logger.error("[Transcription Callback] - S3 storage is not configured, cannot store the result of job {jobId}", job.id)
		if (job.status === "completed") setDocxStored(job, false)
		return
	}
	const ref = { userId: job.userId, jobId: job.id }

	if (job.status === "completed" && job.result) {
		try {
			const bytes = await buildTranscriptionDocx({
				fileName: job.fileName,
				completedAt: job.updatedAt,
				durationSeconds: durationSeconds ?? null,
				text: job.result.text,
				paragraphs: job.result.paragraphs
			})
			await putDocx(storage, { ...ref, fileName: job.fileName, bytes })
			setDocxStored(job, true)
		} catch (error) {
			logger.errorException(error, "[Transcription Callback] - Failed to store the Word document for job {jobId}", job.id)
			setDocxStored(job, false)
		}
	}

	try {
		await deleteAudio(storage, ref)
	} catch (error) {
		logger.errorException(error, "[Transcription Callback] - Failed to delete the audio of job {jobId}", job.id)
	}
}

export const POST: RequestHandler = async ({ request, url }) => {
	const secret = env.TRANSCRIPTION_CALLBACK_SECRET
	if (!secret) {
		return json({ message: "Server misconfiguration: TRANSCRIPTION_CALLBACK_SECRET is not set" }, { status: 500 })
	}
	if (url.searchParams.get("secret") !== secret) {
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
	if (job) {
		await storeResult(job, parsed.data.duration_seconds)
	}

	return json({ ok: true, localJobId: job?.id }, { status: 200 })
}
