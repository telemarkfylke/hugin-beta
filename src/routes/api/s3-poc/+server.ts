import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import { canUseS3Poc } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { limitBytes } from "$lib/server/files/upload-guards"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { buildObjectKey, MAX_S3_POC_UPLOAD_BYTES, normalizeContentType, sanitizeFileName } from "$lib/server/s3/s3-keys"
import { getS3PocConfig, listUserObjects, uploadObject } from "$lib/server/s3/s3-poc"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

// Admin check comes first, so a non-admin gets 403 whether or not the feature is switched on
const forbidden = { isAuthorized: false, response: new Response(null, { status: 403 }) }

const listObjects: ApiNextFunction = async ({ user }) => {
	if (!canUseS3Poc(user, APP_CONFIG.APP_ROLES)) {
		return forbidden
	}
	const config = getS3PocConfig()
	if (!config) {
		throw new HTTPError(404, "S3 POC is not enabled")
	}
	try {
		return { isAuthorized: true, response: json({ objects: await listUserObjects(config, user.userId) }) }
	} catch (error) {
		logger.errorException(error, "S3 POC: listing objects failed")
		throw new HTTPError(502, "Kunne ikke hente filer fra S3")
	}
}

/**
 * PUT /api/s3-poc?name=<file name>&type=<media type> with the raw file as the request body.
 * The browser sends the body as application/octet-stream and declares the real type in `type`: the
 * WAF in front of Hugin answers 403 to requests whose Content-Type is a media type such as image/png
 * or video/mp4. The Content-Type header is only a fallback for callers that don't pass `type`.
 */
const uploadObjectHandler: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!canUseS3Poc(user, APP_CONFIG.APP_ROLES)) {
		return forbidden
	}
	const config = getS3PocConfig()
	if (!config) {
		throw new HTTPError(404, "S3 POC is not enabled")
	}

	const { request, url } = requestEvent
	const name = url.searchParams.get("name")
	if (!name || name.length > 255) {
		throw new HTTPError(400, "Missing or invalid file name")
	}
	const contentLength = request.headers.get("content-length")
	if (contentLength && Number(contentLength) > MAX_S3_POC_UPLOAD_BYTES) {
		throw new HTTPError(413, "File is too large")
	}
	if (!request.body) {
		throw new HTTPError(400, "Missing file")
	}

	const uploadId = crypto.randomUUID()
	const key = buildObjectKey(config.keyPrefix, user.userId, uploadId, name)
	try {
		await uploadObject(config, {
			key,
			// The byte limit also covers requests without (or with a lying) Content-Length
			body: request.body.pipeThrough(limitBytes(MAX_S3_POC_UPLOAD_BYTES)),
			contentType: normalizeContentType(url.searchParams.get("type") ?? request.headers.get("content-type")),
			// Metadata values must be ASCII, so the original name is percent-encoded
			metadata: { "uploaded-by": user.userId, "original-name": encodeURIComponent(name) }
		})
	} catch (error) {
		// The byte limit errors the body stream; the SDK may surface that directly or as the cause
		if (error instanceof HTTPError) throw error
		if (error instanceof Error && error.cause instanceof HTTPError) throw error.cause
		logger.errorException(error, "S3 POC: upload failed")
		throw new HTTPError(502, "Opplastingen til S3 feilet")
	}
	logger.info("S3 POC: user {userId} uploaded {key}", user.userId, key)
	return { isAuthorized: true, response: json({ object: { key, fileName: sanitizeFileName(name), size: contentLength ? Number(contentLength) : null } }, { status: 201 }) }
}

export const GET: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, listObjects)
export const PUT: RequestHandler = async (requestEvent) => apiRequestMiddleware(requestEvent, uploadObjectHandler)
