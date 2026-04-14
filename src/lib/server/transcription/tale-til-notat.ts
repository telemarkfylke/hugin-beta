import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"

type TriggerParams = {
	upn: string
	fileName: string
	callbackUrl: string
}

/**
 * Trigger a transcription job on tale-til-notat.
 * Passes a source_url (internal Copyparty HTTP URL) so tale-til-notat downloads
 * the file directly — no shared volume required.
 * Returns the tale-til-notat job_id.
 */
export const triggerTranscription = async ({ upn, fileName, callbackUrl }: TriggerParams): Promise<string> => {
	const taleUrl = env.TALE_TIL_NOTAT_URL
	if (!taleUrl) {
		throw new HTTPError(500, "TALE_TIL_NOTAT_URL is not configured")
	}
	const copypartyBase = env.COPYPARTY_BASE_URL
	if (!copypartyBase) {
		throw new HTTPError(500, "COPYPARTY_BASE_URL is not configured")
	}

	const sourceUrl = `${copypartyBase.replace(/\/$/, "")}/${encodeURIComponent(upn)}/${encodeURIComponent(fileName)}`

	const form = new FormData()
	form.append("source_url", sourceUrl)
	form.append("callback_url", callbackUrl)
	form.append("upn", upn)
	form.append("user_email", upn)
	form.append("language", "no")

	let res: Response
	try {
		res = await fetch(`${taleUrl.replace(/\/$/, "")}/transcribe`, { method: "POST", body: form })
	} catch (err) {
		throw new HTTPError(502, `Kunne ikke nå tale-til-notat: ${(err as Error).message}`)
	}

	if (!res.ok) {
		const body = await res.json().catch(() => ({})) as Record<string, unknown>
		const detail = (body.detail as string) || (body.message as string) || `HTTP ${res.status}`
		throw new HTTPError(502, `tale-til-notat avviste jobben: ${detail}`)
	}

	const data = await res.json() as { job_id: string }
	return data.job_id
}
