import { json, type RequestHandler } from "@sveltejs/kit"
import z from "zod"
import { env } from "$env/dynamic/private"
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
	docxUrl: z.string().url().nullable().optional()
})

const getJobs: ApiNextFunction = async ({ user }) => {
	const jobs = listJobsForUser(user.userId)
	return { isAuthorized: true, response: json({ jobs }) }
}

const createJob: ApiNextFunction = async ({ requestEvent, user }) => {
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = CreateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}
	const job = createPendingJob(user.userId, parsed.data.fileName)
	return { isAuthorized: true, response: json({ job }, { status: 201 }) }
}

const patchJob: ApiNextFunction = async ({ requestEvent, user }) => {
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = UpdateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}

	const job = getJobById(user.userId, parsed.data.id)
	if (!job) {
		throw new HTTPError(404, "Job not found")
	}

	const secret = env.TRANSCRIPTION_CALLBACK_SECRET
	if (!secret) {
		throw new HTTPError(500, "TRANSCRIPTION_CALLBACK_SECRET is not configured")
	}
	const callbackUrl = `${requestEvent.url.origin}/api/transcription/callback?secret=${encodeURIComponent(secret)}`
	const taleJobId = await triggerTranscription({
		userId: user.userId,
		fileName: job.fileName,
		callbackUrl
	})

	markJobProcessing(user.userId, parsed.data.id, taleJobId)
	return { isAuthorized: true, response: json({ ok: true }) }
}

const deleteJob: ApiNextFunction = async ({ requestEvent, user }) => {
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")

	const body = await requestEvent.request.json().catch(() => null)
	const parsed = DeleteJobSchema.safeParse(body)
	if (!parsed.success) throw new HTTPError(400, "Invalid body", parsed.error.issues)

	const { id, fileName, docxUrl } = parsed.data

	if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
		throw new HTTPError(400, "Invalid fileName")
	}

	const audioUrl = `${copypartyBase}/${encodeURIComponent(user.userId)}/${encodeURIComponent(fileName)}`
	await fetch(audioUrl, { method: "DELETE" }).catch(() => null)

	if (docxUrl && docxUrl.startsWith(copypartyBase)) {
		await fetch(docxUrl, { method: "DELETE" }).catch(() => null)
	}

	removeJob(user.userId, id)
	return { isAuthorized: true, response: json({ ok: true }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, getJobs)
export const POST: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, createJob)
export const PATCH: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, patchJob)
export const DELETE: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, deleteJob)
