import { logger } from "@vestfoldfylke/loglady"
import { canUseS3Poc } from "$lib/authorization"
import { HTTPError } from "$lib/server/middleware/http-error"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import { MAX_S3_POC_UPLOAD_BYTES } from "$lib/server/s3/s3-keys"
import { getS3PocConfig, listUserObjects } from "$lib/server/s3/s3-poc"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import type { S3PocObject } from "$lib/types/s3-poc"
import type { PageServerLoad } from "./$types"

type S3PocPageData = {
	objects: S3PocObject[]
	listError: string | null
	bucket: string
	maxUploadBytes: number
}

const s3PocPageLoad: ServerLoadNextFunction<S3PocPageData> = async ({ user }) => {
	const emptyData: S3PocPageData = { objects: [], listError: null, bucket: "", maxUploadBytes: MAX_S3_POC_UPLOAD_BYTES }
	if (!canUseS3Poc(user)) {
		return { data: emptyData, isAuthorized: false }
	}
	const config = getS3PocConfig()
	if (!config) {
		throw new HTTPError(404, "S3 POC is not enabled")
	}
	// A broken S3 connection is what this page exists to find out about, so show it instead of an error page
	try {
		return { data: { ...emptyData, bucket: config.bucket, objects: await listUserObjects(config, user.userId) }, isAuthorized: true }
	} catch (error) {
		logger.errorException(error, "S3 POC: listing objects failed")
		return { data: { ...emptyData, bucket: config.bucket, listError: "Kunne ikke koble til S3. Sjekk loggene for detaljer." }, isAuthorized: true }
	}
}

export const load: PageServerLoad = async (requestEvent): Promise<S3PocPageData> => {
	return serverLoadRequestMiddleware(requestEvent, s3PocPageLoad)
}
