import { json, type RequestHandler } from "@sveltejs/kit"
import z from "zod"
import { env } from "$env/dynamic/private"
import { canUseTranscription } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { buildAudioUrl, buildLegacyAudioUrl, hasAcceptedAudioExtension, isSafePathSegment, resolveOwnDocxUrl, resolveUrlUnderBase } from "$lib/server/transcription/copyparty-paths"
import { createPendingJob, getJobById, listJobsForUser, markJobProcessing, removeJob } from "$lib/server/transcription/job-store"
import { triggerTranscription } from "$lib/server/transcription/tale-til-notat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

const DeleteJobSchema = z.object({
	id: z.string().min(1),
	fileName: z.string().min(1),
	audioUrl: z.string().url().nullable().optional(),
	docxUrl: z.string().url().nullable().optional()
})

const forbidden = () => ({ isAuthorized: false, response: json({ message: "Forbidden" }, { status: 403 }) })

const getJobs: ApiNextFunction = async ({ user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const jobs = listJobsForUser(user.userId)
	return { isAuthorized: true, response: json({ jobs }) }
}

const createJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = CreateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}
	// fileName becomes a Copyparty path segment (upload, delete) - validate it once, here.
	if (!isSafePathSegment(parsed.data.fileName) || !hasAcceptedAudioExtension(parsed.data.fileName)) {
		throw new HTTPError(400, "Invalid fileName")
	}
	const job = createPendingJob(user.userId, parsed.data.fileName)
	return { isAuthorized: true, response: json({ job }, { status: 201 }) }
}

const patchJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
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

	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")

	const secret = env.TRANSCRIPTION_CALLBACK_SECRET
	if (!secret) {
		throw new HTTPError(500, "TRANSCRIPTION_CALLBACK_SECRET is not configured")
	}
	const callbackUrl = `${requestEvent.url.origin}/api/transcription/callback?secret=${encodeURIComponent(secret)}`

	// Construct the canonical audio URL using the job id in the path — this is what was
	// uploaded to (via the upload proxy), so it is guaranteed to be unique and never renamed by Copyparty.
	const audioUrl = buildAudioUrl(copypartyBase, user.userId, job.id, job.fileName)

	const taleJobId = await triggerTranscription({
		userId: user.userId,
		audioUrl,
		callbackUrl
	})

	markJobProcessing(user.userId, parsed.data.id, taleJobId, audioUrl)
	return { isAuthorized: true, response: json({ ok: true }) }
}

const deleteJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseTranscription(user, APP_CONFIG.APP_ROLES)) return forbidden()
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")

	const body = await requestEvent.request.json().catch(() => null)
	const parsed = DeleteJobSchema.safeParse(body)
	if (!parsed.success) throw new HTTPError(400, "Invalid body", parsed.error.issues)

	const { id, fileName, audioUrl: clientAudioUrl, docxUrl: clientDocxUrl } = parsed.data
	if (!isSafePathSegment(id) || !isSafePathSegment(fileName)) {
		throw new HTTPError(400, "Invalid id or fileName")
	}

	const job = getJobById(user.userId, id)

	// Audio URLs are always built server-side inside the caller's own folder - a client-supplied URL is
	// never fetched. Priority: in-memory job → <user>/<id>/<fileName> (jobs that survive a restart only in
	// localStorage, recognised by having had an audioUrl) → legacy <user>/<fileName>.
	const effectiveAudioUrl = job?.audioUrl ?? (clientAudioUrl ? buildAudioUrl(copypartyBase, user.userId, id, fileName) : buildLegacyAudioUrl(copypartyBase, user.userId, fileName))
	await fetch(`${effectiveAudioUrl}?delete`, { method: "POST" }).catch(() => null)

	// docx: the in-memory value came from tale-til-notat and only has to be inside Copyparty; a
	// client-supplied value must be a .docx directly in the caller's own folder.
	const effectiveDocxUrl = job?.result?.docx_url ? resolveUrlUnderBase(copypartyBase, job.result.docx_url) : clientDocxUrl ? resolveOwnDocxUrl(copypartyBase, user.userId, clientDocxUrl) : null
	if (effectiveDocxUrl) {
		await fetch(`${effectiveDocxUrl.href}?delete`, { method: "POST" }).catch(() => null)
	}

	removeJob(user.userId, id)
	return { isAuthorized: true, response: json({ ok: true }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, getJobs)
export const POST: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, createJob)
export const PATCH: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, patchJob)
export const DELETE: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, deleteJob)
