import { randomUUID } from "node:crypto"
import type { TranscriptionCallback, TranscriptionJob } from "./types"

const jobsByUpn = new Map<string, TranscriptionJob[]>()

const normalizeUpn = (upn: string) => upn.trim().toLowerCase()

export const createPendingJob = (upn: string, fileName: string): TranscriptionJob => {
	const now = new Date().toISOString()
	const job: TranscriptionJob = {
		id: randomUUID(),
		upn,
		fileName,
		status: "uploading",
		createdAt: now,
		updatedAt: now
	}
	const key = normalizeUpn(upn)
	const list = jobsByUpn.get(key) ?? []
	list.unshift(job)
	jobsByUpn.set(key, list)
	return job
}

export const markJobProcessing = (upn: string, jobId: string): void => {
	const job = getJobById(upn, jobId)
	if (!job) return
	job.status = "processing"
	job.updatedAt = new Date().toISOString()
}

export const listJobsForUpn = (upn: string): TranscriptionJob[] => {
	return jobsByUpn.get(normalizeUpn(upn)) ?? []
}

export const getJobById = (upn: string, id: string): TranscriptionJob | undefined => {
	return listJobsForUpn(upn).find((j) => j.id === id)
}

export const applyCallback = (payload: TranscriptionCallback): TranscriptionJob | undefined => {
	const list = listJobsForUpn(payload.upn)
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
			upn: payload.upn,
			fileName: "(ukjent fil)",
			status: "uploading",
			createdAt: now,
			updatedAt: now
		}
		const key = normalizeUpn(payload.upn)
		const existing = jobsByUpn.get(key) ?? []
		existing.unshift(job)
		jobsByUpn.set(key, existing)
	}

	job.jobId = payload.job_id
	job.status = payload.status === "completed" ? "completed" : "failed"
	job.updatedAt = payload.completed_at || new Date().toISOString()
	job.durationSeconds = payload.duration_seconds ?? null
	job.error = payload.error ?? null
	job.result = payload.result ?? null
	return job
}
