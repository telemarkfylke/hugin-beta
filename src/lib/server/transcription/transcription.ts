import { ConfidentialClientApplication } from "@azure/msal-node"
import axios from "axios"
import { env } from "$env/dynamic/private"

type TranscriptionMetadata = { filnavn: string; spraak: string; format: string; selectedFileName: string | null }

const { VITE_AI_API_URI: aiApiUri, VITE_TRANSCRIPTION_APPREG_ID: client_id, VITE_TRANSCRIPTION_APPREG_KEY: client_secret, VITE_APPREG_TENANT_ID: tenant_id } = import.meta.env
const authority = `https://login.microsoftonline.com/${tenant_id}`

const config = {
	auth: {
		clientId: client_id,
		authority: authority,
		clientSecret: client_secret
	}
}
const cca = new ConfidentialClientApplication(config)

let cachedToken: string | null = null
let cachedTokenExpiresOn: number = 0

const tokenRequest = {
	scopes: ["https://graph.microsoft.com/.default"] // or your API scope
}

export async function sendFileToTranscription(userUpn: string, filliste: Blob, metadata: TranscriptionMetadata): Promise<{ responseCode: number; message: string }> {
	/*
		const decoded = jwtDecode(bearerToken)
		const user_upn = (decoded as any).upn	
	*/

	const datapakken = new FormData()
	datapakken.append("filer", filliste)
	datapakken.append("filnavn", metadata.filnavn)
	datapakken.append("spraak", metadata.spraak)
	datapakken.append("format", metadata.format)
	datapakken.append("upn", userUpn)

	const token = env.TRANSCRIPTION_MOCK_TOKEN ? env.TRANSCRIPTION_MOCK_TOKEN : getToken()

	try {
		const response = await axios.post(`${aiApiUri}/nbTranscript`, datapakken, {
			method: "post",
			data: datapakken,
			headers: {
				"Content-Type": "multipart/form-data",
				authorization: `Bearer ${token}`
			}
		})

		/*
		const response = await fetch(`${aiApiUri}/nbTranscript`, {
			method: 'POST',
			//data: datapakken,
			headers: {
				'Content-Type': 'multipart/form-data',
				authorization: `Bearer ${token}`
			},
			body:datapakken
		})
*/
		const resMessage = response.statusText
		console.log(resMessage)
		return { responseCode: response.status, message: response.statusText }
	} catch (error) {
		console.log(error)
		throw error
	}
}

export async function getToken(): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	if (cachedToken && now < cachedTokenExpiresOn - 60) {
		return cachedToken
	}
	const response = await cca.acquireTokenByClientCredential(tokenRequest)
	if (response?.accessToken) {
		cachedToken = response.accessToken
		cachedTokenExpiresOn = Math.floor((response.expiresOn as Date).getTime() / 1000)
		return response?.accessToken
	} else {
		console.error("Could not get access token")
	}
	return ""
}
