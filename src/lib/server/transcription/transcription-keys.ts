/**
 * S3 key layout for transcription. Every file of a job lives under one prefix, so deleting a job is
 * "delete everything under the prefix":
 *   transcription/<userId>/<jobId>/audio/<fileName>
 *   transcription/<userId>/<jobId>/transkripsjon.docx
 * userId comes from auth and jobId from the server; all three parts are still checked here, so a bad
 * value throws instead of producing a key outside the user's own prefix.
 */

import { isSafePathSegment } from "$lib/server/files/upload-guards"

export const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".mp4", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".mkv", ".avi", ".wma"]

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

const KEY_ROOT = "transcription"

export const hasAcceptedAudioExtension = (fileName: string): boolean => {
	const lower = fileName.toLowerCase()
	return ACCEPTED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

const assertSegment = (value: string, label: string): void => {
	if (!isSafePathSegment(value)) {
		throw new Error(`Unsafe ${label} for a transcription key`)
	}
}

export const jobPrefix = (userId: string, jobId: string): string => {
	assertSegment(userId, "user id")
	assertSegment(jobId, "job id")
	return `${KEY_ROOT}/${userId}/${jobId}/`
}

export const audioKey = (userId: string, jobId: string, fileName: string): string => {
	assertSegment(fileName, "file name")
	return `${jobPrefix(userId, jobId)}audio/${fileName}`
}

export const docxKey = (userId: string, jobId: string): string => `${jobPrefix(userId, jobId)}transkripsjon.docx`
