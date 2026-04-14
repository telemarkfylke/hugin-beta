import { json, type RequestHandler } from "@sveltejs/kit"
import { env } from "$env/dynamic/private"
import z from "zod"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { createPendingJob, getJobById, listJobsForUpn, markJobProcessing } from "$lib/server/transcription/job-store"
import { triggerTranscription } from "$lib/server/transcription/tale-til-notat"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const CreateJobSchema = z.object({
	fileName: z.string().min(1)
})

const UpdateJobSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["processing"])
})

const getJobs: ApiNextFunction = async ({ user }) => {
	if (!user.preferredUserName) {
		throw new HTTPError(400, "preferredUserName is required")
	}
	const jobs = listJobsForUpn(user.preferredUserName)
	return { isAuthorized: true, response: json({ jobs }) }
}

const createJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.preferredUserName) {
		throw new HTTPError(400, "preferredUserName is required")
	}
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = CreateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}
	const job = createPendingJob(user.preferredUserName, parsed.data.fileName)
	return { isAuthorized: true, response: json({ job }, { status: 201 }) }
}

const patchJob: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.preferredUserName) {
		throw new HTTPError(400, "preferredUserName is required")
	}
	const body = await requestEvent.request.json().catch(() => null)
	const parsed = UpdateJobSchema.safeParse(body)
	if (!parsed.success) {
		throw new HTTPError(400, "Invalid body", parsed.error.issues)
	}

	const job = getJobById(user.preferredUserName, parsed.data.id)
	if (!job) {
		throw new HTTPError(404, "Job not found")
	}

	const baseUrl = env.HUGIN_BASE_URL?.replace(/\/$/, "") ?? requestEvent.url.origin
	const callbackUrl = `${baseUrl}/api/transcription/callback`
	const taleJobId = await triggerTranscription({
		upn: user.preferredUserName,
		fileName: job.fileName,
		callbackUrl
	})

	markJobProcessing(user.preferredUserName, parsed.data.id, taleJobId)
	return { isAuthorized: true, response: json({ ok: true }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, getJobs)
export const POST: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, createJob)
export const PATCH: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, patchJob)
