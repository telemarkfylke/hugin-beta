import { ConfidentialClientApplication } from "@azure/msal-node"
import axios from "axios"
import { env } from "$env/dynamic/private"

type TranscriptionMetadata = { filnavn: string; spraak: string; format: string; selectedFileName: string | null }

let cca: ConfidentialClientApplication | null = null
function getCca(): ConfidentialClientApplication {
	if (!cca) {
		const authority = `https://login.microsoftonline.com/${env.APPREG_TENANT_ID}`
		cca = new ConfidentialClientApplication({
			auth: {
				clientId: env.TRANSCRIPTION_APPREG_ID ?? "",
				authority,
				clientSecret: env.TRANSCRIPTION_APPREG_KEY ?? ""
			}
		})
	}
	return cca
}

let cachedToken: string | null = null
let cachedTokenExpiresOn: number = 0

const getTokenRequest = () => ({
	scopes: (env.TRANSCRIPTION_SCOPES ?? "").split(";")
})

/*
async function _sendWithFetch(datapakken: FormData, token: string): Promise<Response> {
	return fetch(`${aiApiUri}/nbTranscript`, {
		method: "POST",
		headers: {
			"Content-Type": "multipart/form-data",
			authorization: `Bearer ${token}`
		},
		body: datapakken
	})
}
*/
async function sendWithAxios(datapakken: FormData, token: string): Promise<Response> {
	return axios.post(`${env.AI_API_URI}/nbTranscript`, datapakken, {
		method: "post",
		data: datapakken,
		headers: {
			"Content-Type": "multipart/form-data",
			authorization: `Bearer ${token}`
		}
	})
}

export async function sendFileToTranscription(userUpn: string, filliste: Blob, metadata: TranscriptionMetadata): Promise<{ responseCode: number; message: string }> {
	/*
		const decoded = jwtDecode(bearerToken)
		const user_upn = (decoded as any).upn	
	*/
	try {
		const datapakken = new FormData()
		datapakken.append("filer", filliste)
		datapakken.append("filnavn", metadata.filnavn)
		datapakken.append("spraak", metadata.spraak)
		datapakken.append("format", metadata.format)
		datapakken.append("upn", userUpn)

		const token = env.TRANSCRIPTION_MOCK_TOKEN ? env.TRANSCRIPTION_MOCK_TOKEN : await getToken()

		//const response = await _sendWithFetch(datapakken, token)
		const response = await sendWithAxios(datapakken, token)
		return { responseCode: response.status, message: response.statusText }
	} catch (error) {
		return { responseCode: 500, message: (error as Error).message || "Internal server error" }
	}
}

export async function getToken(): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	if (cachedToken && now < cachedTokenExpiresOn - 60) {
		return cachedToken
	}
	const response = await getCca().acquireTokenByClientCredential(getTokenRequest())
	if (response?.accessToken) {
		cachedToken = response.accessToken
		cachedTokenExpiresOn = Math.floor((response.expiresOn as Date).getTime() / 1000)
		return response?.accessToken
	} else {
		console.error("Could not get access token")
	}
	return ""
}
