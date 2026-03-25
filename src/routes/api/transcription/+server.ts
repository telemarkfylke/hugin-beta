import { json, type RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { MS_AUTH_TOKEN_HEADER } from "$lib/server/auth/auth-constants"
import { sendFileToTranscription } from "$lib/server/transcription/transcription"
import type { TranscriptionMetadata } from "$lib/server/transcription/types"
import { env } from "$env/dynamic/private"

const postTranscription: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	
	const bearerToken = env.TRANSCRIPTION_MOCK_TOKEN ? env.TRANSCRIPTION_MOCK_TOKEN : requestEvent.request.headers.get(MS_AUTH_TOKEN_HEADER)
	const formdata = await requestEvent.request.formData()
	
	const fileList:Blob = formdata.get("filelist") as Blob
	const metadata:TranscriptionMetadata = formdata.get("metadata") as any 

	const success = await sendFileToTranscription(fileList, metadata, bearerToken)

	return {
		isAuthorized: true,
		response: json({ success:success })
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, postTranscription)
}