import { DeleteObjectsCommand, GetObjectCommand, type ObjectIdentifier, PutObjectCommand, paginateListObjectsV2 } from "@aws-sdk/client-s3"
import { env } from "$env/dynamic/private"
import { getS3Client, getS3Connection, type S3Connection } from "$lib/server/s3/s3-client"
import type { IAttachmentBlobStore } from "./interface"

/** The shared Hugin bucket: the (HTTPS-only) S3 connection plus S3_HUGIN_BUCKET. */
export type HuginBucketStorage = S3Connection & { bucket: string }

/**
 * The storage config, or null when the S3 connection or S3_HUGIN_BUCKET is missing (or the endpoint is
 * not HTTPS). Null means attachments keep being stored inline in the message, as before.
 */
export const getHuginBucketStorage = (): HuginBucketStorage | null => {
	const connection = getS3Connection()
	const bucket = env.S3_HUGIN_BUCKET?.trim()
	if (!connection || !bucket) {
		return null
	}
	return { ...connection, bucket }
}

export class S3AttachmentBlobStore implements IAttachmentBlobStore {
	private readonly storage: HuginBucketStorage

	constructor(storage: HuginBucketStorage) {
		this.storage = storage
	}

	async put(key: string, bytes: Uint8Array): Promise<void> {
		// Attachments are small enough (bounded by the request body limit) for a single PUT - no multipart needed
		await getS3Client(this.storage).send(new PutObjectCommand({ Bucket: this.storage.bucket, Key: key, Body: bytes, ContentType: "application/octet-stream" }))
	}

	async get(key: string): Promise<Uint8Array | null> {
		try {
			const object = await getS3Client(this.storage).send(new GetObjectCommand({ Bucket: this.storage.bucket, Key: key }))
			return object.Body ? await object.Body.transformToByteArray() : null
		} catch (error) {
			if (error instanceof Error && error.name === "NoSuchKey") return null
			throw error
		}
	}

	async deletePrefix(prefix: string): Promise<void> {
		const client = getS3Client(this.storage)
		for await (const page of paginateListObjectsV2({ client }, { Bucket: this.storage.bucket, Prefix: prefix })) {
			const objects: ObjectIdentifier[] = (page.Contents ?? []).flatMap((item) => (item.Key ? [{ Key: item.Key }] : []))
			if (objects.length > 0) {
				await client.send(new DeleteObjectsCommand({ Bucket: this.storage.bucket, Delete: { Objects: objects, Quiet: true } }))
			}
		}
	}
}
