import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import z from "zod"
import { env } from "$env/dynamic/private"
import { canUseTranscription } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { isSafePathSegment } from "$lib/server/files/upload-guards"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createPendingJob, getJobById, listJobsForUser, markJobProcessing, removeJob } from "$lib/server/transcription/job-store"
import { requireTranscriptionStorage } from "$lib/server/transcription/require-storage"
import { triggerTranscription } from "$lib/server/transcription/tale-til-notat"
import { hasAcceptedAudioExtension } from "$lib/server/transcription/transcription-keys"
import { deleteJobFiles, presignAudioUrl } from "$lib/server/transcription/transcription-storage"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

// Only the id: every file of a job lives under the caller's own <userId>/<id>/ prefix, so nothing else is needed or trusted
const DeleteJobSchema = z.object({
	id: z.string().min(1)
})

const forbidden = () => ({ isAuthorized: false, response: json({ message: "Forbidden" }, { status: 403 }) })

const getJobs: ApiNextFunction = async ({ user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const jobs = listJobsForUser(user.userId)
	return { isAuthorized: true, response: json({ jobs }) }
}

const createJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	requireTranscriptionStorage()
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = CreateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}
	// fileName becomes part of an S3 key - validate it once, here.
	if (!isSafePathSegment(parsed.data.fileName) || !hasAcceptedAudioExtension(parsed.data.fileName)) {
		throw new HTTPError(400, "Invalid fileName")
	}
	const job = createPendingJob(user.userId, parsed.data.fileName)
	return { isAuthorized: true, response: json({ job }, { status: 201 }) }
}

const patchJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const storage = requireTranscriptionStorage()
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = UpdateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}

	const job = getJobById(user.userId, parsed.data.id)
	if (!job) {
		throw new HTTPError(404, "Job not found")
	}
	// Only a freshly uploaded job may be started - stops the same file being transcribed twice.
	if (job.status !== "uploading") {
		throw new HTTPError(409, "Job is already started")
	}

	const secret = env.TRANSCRIPTION_CALLBACK_SECRET
	if (!secret) {
		throw new HTTPError(500, "TRANSCRIPTION_CALLBACK_SECRET is not configured")
	}
	const callbackUrl = `${requestEvent.url.origin}/api/transcription/callback?secret=${encodeURIComponent(secret)}`

	// tale-til-notat downloads the audio itself, through a short-lived read-only HTTPS link - it never gets S3 keys
	const audioUrl = await presignAudioUrl(storage, { userId: user.userId, jobId: job.id, fileName: job.fileName })

	const taleJobId = await triggerTranscription({
		userId: user.userId,
		audioUrl,
		callbackUrl
	})

	markJobProcessing(user.userId, parsed.data.id, taleJobId)
	return { isAuthorized: true, response: json({ ok: true }) }
}

const deleteJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const storage = requireTranscriptionStorage()

	const body = await requestEvent.request.json().catch(() => null)
	const parsed = DeleteJobSchema.safeParse(body)
	if (!parsed.success) throw new HTTPError(400, "Invalid body", parsed.error.issues)
	const { id } = parsed.data
	if (!isSafePathSegment(id)) {
		throw new HTTPError(400, "Invalid id")
	}

	// Works for jobs the in-memory store has forgotten too (after a restart): the files are found by prefix
	try {
		await deleteJobFiles(storage, { userId: user.userId, jobId: id })
	} catch (error) {
		logger.errorException(error, "[Transcription] - Failed to delete the files of job {jobId}", id)
		throw new HTTPError(502, "Kunne ikke slette filene")
	}

	removeJob(user.userId, id)
	return { isAuthorized: true, response: json({ ok: true }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, getJobs)
export const POST: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, createJob)
export const PATCH: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, patchJob)
export const DELETE: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, deleteJob)
