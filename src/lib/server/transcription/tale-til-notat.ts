import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"

type TriggerParams = {
	userId: string
	audioUrl: string
	callbackUrl: string
}

/**
 * Trigger a transcription job on tale-til-notat.
 * Passes the exact audioUrl (Copyparty path including jobId) so tale-til-notat downloads
 * the file directly — no shared volume required.
 * Returns the tale-til-notat job_id.
 */
export const triggerTranscription = async ({ userId, audioUrl, callbackUrl }: TriggerParams): Promise<string> => {
	const taleUrl = env.TALE_TIL_NOTAT_URL
	if (!taleUrl) {
		throw new HTTPError(500, "TALE_TIL_NOTAT_URL is not configured")
	}

	const form = new FormData()
	form.append("source_url", audioUrl)
	form.append("callback_url", callbackUrl)
	form.append("upn", userId)
	form.append("language", "no")

	// Upstream details go to the log only - the user gets a generic message.
	let res: Response
	try {
		res = await fetch(`${taleUrl}/transcribe`, { method: "POST", body: form })
	} catch (err) {
		logger.errorException(err, "[Transcription] - Could not reach tale-til-notat")
		throw new HTTPError(502, "Kunne ikke nå transkripsjonstjenesten")
	}

	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
		const detail = (body.detail as string) || (body.message as string) || ""
		logger.warn("[Transcription] - tale-til-notat rejected job with status {status}: {detail}", res.status, JSON.stringify(detail))
		throw new HTTPError(502, `Transkripsjonstjenesten avviste jobben (HTTP ${res.status})`)
	}

	const data = (await res.json()) as { job_id: string }
	return data.job_id
}
