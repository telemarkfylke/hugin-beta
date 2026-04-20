import { json, type RequestHandler } from "@sveltejs/kit"
import z from "zod"
import { env } from "$env/dynamic/private"
import { checkFeature } from "$lib/features/featuremap"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
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

const getJobs: ApiNextFunction = async ({ user }) => {
	if (!checkFeature("TRANSCRIPTION")) {
		throw new HTTPError(423, "Feature is locked")
	}
	const jobs = listJobsForUser(user.userId)
	return { isAuthorized: true, response: json({ jobs }) }
}

const createJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!checkFeature("TRANSCRIPTION")) {
		throw new HTTPError(423, "Feature is locked")
	}
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = CreateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}
	const job = createPendingJob(user.userId, parsed.data.fileName)
	return { isAuthorized: true, response: json({ job }, { status: 201 }) }
}

const patchJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!checkFeature("TRANSCRIPTION")) {
		throw new HTTPError(423, "Feature is locked")
	}
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = UpdateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}

	const job = getJobById(user.userId, parsed.data.id)
	if (!job) {
		throw new HTTPError(404, "Job not found")
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
	const audioUrl = `${copypartyBase}/${encodeURIComponent(user.userId)}/${encodeURIComponent(job.id)}/${encodeURIComponent(job.fileName)}`

	const taleJobId = await triggerTranscription({
		userId: user.userId,
		audioUrl,
		callbackUrl
	})

	markJobProcessing(user.userId, parsed.data.id, taleJobId, audioUrl)
	return { isAuthorized: true, response: json({ ok: true }) }
}

const deleteJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!checkFeature("TRANSCRIPTION")) {
		throw new HTTPError(423, "Feature is locked")
	}
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")

	const body = await requestEvent.request.json().catch(() => null)
	const parsed = DeleteJobSchema.safeParse(body)
	if (!parsed.success) throw new HTTPError(400, "Invalid body", parsed.error.issues)

	const { id, fileName, audioUrl: clientAudioUrl, docxUrl } = parsed.data

	const job = getJobById(user.userId, id)

	// Priority: in-memory job's audioUrl → client-provided audioUrl (survives server restarts via
	// localStorage) → legacy fallback: construct from fileName (for jobs created before this change).
	// Guard against SSRF — only delete from the configured Copyparty base URL.
	const effectiveAudioUrl = job?.audioUrl ?? (clientAudioUrl?.startsWith(copypartyBase) ? clientAudioUrl : null)
	if (effectiveAudioUrl) {
		await fetch(`${effectiveAudioUrl}?delete`, { method: "POST" }).catch(() => null)
	} else {
		if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
			throw new HTTPError(400, "Invalid fileName")
		}
		await fetch(`${copypartyBase}/${encodeURIComponent(user.userId)}/${encodeURIComponent(fileName)}?delete`, { method: "POST" }).catch(() => null)
	}

	// Same priority for docx: in-memory job result → client-provided value.
	const effectiveDocxUrl = job?.result?.docx_url ?? docxUrl
	if (effectiveDocxUrl && effectiveDocxUrl.startsWith(copypartyBase)) {
		await fetch(`${effectiveDocxUrl}?delete`, { method: "POST" }).catch(() => null)
	}

	removeJob(user.userId, id)
	return { isAuthorized: true, response: json({ ok: true }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, getJobs)
export const POST: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, createJob)
export const PATCH: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, patchJob)
export const DELETE: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, deleteJob)
