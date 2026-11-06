import { Readable } from "node:stream"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"
import { DeleteObjectsCommand, GetObjectCommand, type ObjectIdentifier, PutObjectCommand, paginateListObjectsV2 } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "$env/dynamic/private"
import { getS3Client, getS3Connection, type S3Connection } from "$lib/server/s3/s3-client"
import { audioKey, docxKey, jobPrefix } from "./transcription-keys"

/** Where transcription files live: the shared (HTTPS-only) S3 connection plus S3_TRANSCRIPTION_BUCKET. */
export type TranscriptionStorage = S3Connection & { bucket: string }

type JobRef = { userId: string; jobId: string }

const PART_SIZE_BYTES = 8 * 1024 * 1024

/**
 * How long tale-til-notat may use the audio link. Long enough to survive a queue behind other jobs, short
 * enough that a leaked link soon stops working. The audio is deleted when the callback arrives anyway.
 */
const AUDIO_URL_TTL_SECONDS = 6 * 60 * 60

const DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

/** The storage config, or null when the S3 connection or the bucket is missing, or the endpoint is not HTTPS. */
export const getTranscriptionStorage = (): TranscriptionStorage | null => {
	const connection = getS3Connection()
	const bucket = env.S3_TRANSCRIPTION_BUCKET?.trim()
	if (!connection || !bucket) {
		return null
	}
	return { ...connection, bucket }
}

/** Streams the audio to S3 as a multipart upload, so a large file is never held in memory. Rejects with the stream's own error (e.g. the size limit). */
export const uploadAudio = async (storage: TranscriptionStorage, params: JobRef & { fileName: string; body: ReadableStream<Uint8Array> }): Promise<void> => {
	const upload = new Upload({
		client: getS3Client(storage),
		partSize: PART_SIZE_BYTES,
		queueSize: 4,
		params: {
			Bucket: storage.bucket,
			Key: audioKey(params.userId, params.jobId, params.fileName),
			Body: Readable.fromWeb(params.body as unknown as NodeReadableStream),
			ContentType: "application/octet-stream"
		}
	})
	await upload.done()
}

/** A time-limited, read-only HTTPS link to the job's audio, for tale-til-notat - it never gets S3 keys. */
export const presignAudioUrl = async (storage: TranscriptionStorage, params: JobRef & { fileName: string }): Promise<string> => {
	const command = new GetObjectCommand({ Bucket: storage.bucket, Key: audioKey(params.userId, params.jobId, params.fileName) })
	return getSignedUrl(getS3Client(storage), command, { expiresIn: AUDIO_URL_TTL_SECONDS })
}

export const putDocx = async (storage: TranscriptionStorage, params: JobRef & { fileName: string; bytes: Uint8Array }): Promise<void> => {
	await getS3Client(storage).send(
		new PutObjectCommand({
			Bucket: storage.bucket,
			Key: docxKey(params.userId, params.jobId),
			Body: params.bytes,
			ContentType: DOCX_CONTENT_TYPE,
			// Metadata values must be ASCII; keeps the download name working after a restart empties the job store
			Metadata: { "original-name": encodeURIComponent(params.fileName) }
		})
	)
}

/** The job's Word document, or null if there is none. */
export const getDocx = async (storage: TranscriptionStorage, params: JobRef): Promise<{ body: ReadableStream<Uint8Array>; originalName: string | null } | null> => {
	try {
		const object = await getS3Client(storage).send(new GetObjectCommand({ Bucket: storage.bucket, Key: docxKey(params.userId, params.jobId) }))
		if (!object.Body) return null
		const rawName = object.Metadata?.["original-name"]
		let originalName: string | null = null
		try {
			originalName = rawName ? decodeURIComponent(rawName) : null
		} catch {
			originalName = null
		}
		return { body: object.Body.transformToWebStream() as ReadableStream<Uint8Array>, originalName }
	} catch (error) {
		if (error instanceof Error && error.name === "NoSuchKey") return null
		throw error
	}
}

const deleteUnderPrefix = async (storage: TranscriptionStorage, prefix: string): Promise<void> => {
	const client = getS3Client(storage)
	for await (const page of paginateListObjectsV2({ client }, { Bucket: storage.bucket, Prefix: prefix })) {
		const objects: ObjectIdentifier[] = (page.Contents ?? []).flatMap((item) => (item.Key ? [{ Key: item.Key }] : []))
		if (objects.length > 0) {
			await client.send(new DeleteObjectsCommand({ Bucket: storage.bucket, Delete: { Objects: objects, Quiet: true } }))
		}
	}
}

/** Deletes the job's audio (it is only needed until tale-til-notat has transcribed it). */
export const deleteAudio = async (storage: TranscriptionStorage, params: JobRef): Promise<void> => {
	await deleteUnderPrefix(storage, `${jobPrefix(params.userId, params.jobId)}audio/`)
}

/** Deletes every file of the job: audio and document. */
export const deleteJobFiles = async (storage: TranscriptionStorage, params: JobRef): Promise<void> => {
	await deleteUnderPrefix(storage, jobPrefix(params.userId, params.jobId))
}
