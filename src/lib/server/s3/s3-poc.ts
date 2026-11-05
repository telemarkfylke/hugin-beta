import { Readable } from "node:stream"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"
import { paginateListObjectsV2 } from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { env } from "$env/dynamic/private"
import type { S3PocObject } from "$lib/types/s3-poc"
import { getS3Client as getClient, getS3Connection, type S3Connection } from "./s3-client"
import { userKeyPrefix } from "./s3-keys"

// POC: Silo (S3-compatible) behind https://s3.ki.telemarkfylke.no. Everything is server-side; the browser never sees
// the keys or talks to S3 directly (presigned URLs come later, once the browser can reach s3.ki and trust its certificate).
const KEY_PREFIX = "s3-poc"
const PART_SIZE_BYTES = 8 * 1024 * 1024

export type S3PocConfig = S3Connection & {
	bucket: string
	keyPrefix: string
}

/** The POC config, or null while the feature flag is off, a setting is missing or the endpoint is not HTTPS. */
export const getS3PocConfig = (): S3PocConfig | null => {
	const connection = getS3Connection()
	const bucket = env.S3_BUCKET?.trim()
	if (env.S3_POC_ENABLED !== "true" || !connection || !bucket) {
		return null
	}
	return { ...connection, bucket, keyPrefix: KEY_PREFIX }
}

/** Streams the body to S3 as a multipart upload, so a large file is never held in memory. Rejects with the stream's own error if it fails (e.g. the size limit). */
export const uploadObject = async (config: S3PocConfig, params: { key: string; body: ReadableStream<Uint8Array>; contentType: string; metadata: Record<string, string> }): Promise<void> => {
	const upload = new Upload({
		client: getClient(config),
		partSize: PART_SIZE_BYTES,
		queueSize: 4,
		params: {
			Bucket: config.bucket,
			Key: params.key,
			Body: Readable.fromWeb(params.body as unknown as NodeReadableStream),
			ContentType: params.contentType,
			Metadata: params.metadata
		}
	})
	await upload.done()
}

/** The objects under one user's prefix, newest first. */
export const listUserObjects = async (config: S3PocConfig, userId: string): Promise<S3PocObject[]> => {
	const prefix = userKeyPrefix(config.keyPrefix, userId)
	const objects: S3PocObject[] = []
	for await (const page of paginateListObjectsV2({ client: getClient(config) }, { Bucket: config.bucket, Prefix: prefix })) {
		for (const item of page.Contents ?? []) {
			if (item.Key) {
				objects.push({ key: item.Key, fileName: item.Key.slice(prefix.length), size: item.Size ?? 0, lastModified: item.LastModified?.toISOString() ?? null })
			}
		}
	}
	return objects.sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""))
}
