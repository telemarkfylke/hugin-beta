import { json, type RequestHandler } from "@sveltejs/kit"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { sendFileToTranscription } from "$lib/server/transcription/transcription"
import type { TranscriptionMetadata } from "$lib/server/transcription/types"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const postTranscription: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}

	const formdata = await requestEvent.request.formData()

	const fileList: Blob = formdata.get("filelist") as Blob
	const formData: string = (formdata.get("metadata") as string) || ""
	const metadata: TranscriptionMetadata = JSON.parse(formData) // as unknown as TranscriptionMetadata
	const response = await sendFileToTranscription(user.preferredUserName, fileList, metadata)

	if (response.responseCode >= 400) {
		throw new HTTPError(response.responseCode, response.message)
	}

	return {
		isAuthorized: true,
		response: json(response, { status: response.responseCode })
	}
}

export const POST: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, postTranscription)
}
