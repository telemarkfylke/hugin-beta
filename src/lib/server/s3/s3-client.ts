import { S3Client } from "@aws-sdk/client-s3"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"

/** Connection to the S3-compatible server (Silo). Shared by everything in Hugin that stores files in S3. */
export type S3Connection = {
	endpoint: string
	accessKey: string
	secretKey: string
	region: string
}

let warnedAboutInsecureEndpoint = false

/**
 * The S3 connection from S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY (/ S3_REGION), or null when a setting is
 * missing or the endpoint is not HTTPS. All S3 traffic must be encrypted, so an http:// endpoint switches S3 off
 * (logged once) instead of sending files and keys in clear text - there is deliberately no localhost exception.
 */
export const getS3Connection = (): S3Connection | null => {
	const endpoint = env.S3_ENDPOINT?.trim().replace(/\/+$/, "")
	const accessKey = env.S3_ACCESS_KEY
	const secretKey = env.S3_SECRET_KEY
	if (!endpoint || !accessKey || !secretKey) {
		return null
	}
	if (!endpoint.startsWith("https://")) {
		if (!warnedAboutInsecureEndpoint) {
			warnedAboutInsecureEndpoint = true
			logger.error("S3_ENDPOINT must use https:// - S3 storage is disabled until it does")
		}
		return null
	}
	return { endpoint, accessKey, secretKey, region: env.S3_REGION?.trim() || "us-east-1" }
}

let cachedClient: { signature: string; client: S3Client } | undefined

export const getS3Client = (connection: S3Connection): S3Client => {
	const signature = `${connection.endpoint}|${connection.accessKey}|${connection.region}`
	if (cachedClient?.signature !== signature) {
		cachedClient = {
			signature,
			client: new S3Client({
				endpoint: connection.endpoint,
				region: connection.region,
				credentials: { accessKeyId: connection.accessKey, secretAccessKey: connection.secretKey },
				// Path-style (https://s3.ki.../<bucket>/<key>): there is no wildcard DNS or certificate for <bucket>.s3.ki...
				forcePathStyle: true,
				// Newer SDK versions add checksum trailers by default, which not every S3-compatible server accepts
				requestChecksumCalculation: "WHEN_REQUIRED",
				responseChecksumValidation: "WHEN_REQUIRED"
			})
		}
	}
	return cachedClient.client
}
