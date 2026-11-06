import { HTTPError } from "$lib/server/middleware/http-error"
import { getTranscriptionStorage, type TranscriptionStorage } from "./transcription-storage"

/** The transcription storage, or 503 - never accept a file Hugin has nowhere (or no secure way) to store. */
export const requireTranscriptionStorage = (): TranscriptionStorage => {
	const storage = getTranscriptionStorage()
	if (!storage) {
		throw new HTTPError(503, "Transkripsjon er ikke tilgjengelig akkurat nå")
	}
	return storage
}
