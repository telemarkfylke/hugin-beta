import { randomUUID } from "node:crypto"
import type { TranscriptionCallback, TranscriptionJob } from "./types"

const jobsByUserId = new Map<string, TranscriptionJob[]>()

export const createPendingJob = (userId: string, fileName: string): TranscriptionJob => {
	const now = new Date().toISOString()
	const job: TranscriptionJob = {
		id: randomUUID(),
		userId,
		fileName,
		status: "uploading",
		createdAt: now,
		updatedAt: now
	}
	const list = jobsByUserId.get(userId) ?? []
	list.unshift(job)
	jobsByUserId.set(userId, list)
	return job
}

export const markJobProcessing = (userId: string, jobId: string, taleJobId?: string): void => {
	const job = getJobById(userId, jobId)
	if (!job) return
	job.status = "processing"
	job.updatedAt = new Date().toISOString()
	if (taleJobId) job.jobId = taleJobId
}

export const listJobsForUser = (userId: string): TranscriptionJob[] => {
	return jobsByUserId.get(userId) ?? []
}

export const getJobById = (userId: string, id: string): TranscriptionJob | undefined => {
	return listJobsForUser(userId).find((j) => j.id === id)
}

export const applyCallback = (payload: TranscriptionCallback): TranscriptionJob | undefined => {
	const list = listJobsForUser(payload.upn)
	// Prefer matching an already-linked job_id, otherwise take the oldest non-terminal job for this user.
	let job = list.find((j) => j.jobId === payload.job_id)
	if (!job) {
		job = [...list].reverse().find((j) => j.status === "uploading" || j.status === "processing")
	}
	if (!job) {
		// No prior record — create one so the result isn't lost.
		const now = new Date().toISOString()
		job = {
			id: randomUUID(),
			userId: payload.upn,
			fileName: "(ukjent fil)",
			status: "uploading",
			createdAt: now,
			updatedAt: now
		}
		const existing = jobsByUserId.get(payload.upn) ?? []
		existing.unshift(job)
		jobsByUserId.set(payload.upn, existing)
	}

	job.jobId = payload.job_id
	job.status = payload.status === "completed" ? "completed" : "failed"
	job.updatedAt = payload.completed_at || new Date().toISOString()
	job.durationSeconds = payload.duration_seconds ?? null
	job.error = payload.error ?? null
	job.result = payload.result ?? null
	return job
}
