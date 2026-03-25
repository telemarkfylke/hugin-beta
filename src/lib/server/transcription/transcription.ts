
import { jwtDecode } from 'jwt-decode'
const { VITE_AI_API_URI: aiApiUri } = import.meta.env


/*
import { ConfidentialClientApplication, type AccountInfo, type SilentFlowRequest } from "@azure/msal-node";
const { VITE_AI_API_URI: aiApiUri,
	APPREG_CLIENT_ID: client_id,
	APPREG_CLIENT_SECRET: client_secret,
	APPREG_TENANT_ID: tenant_id,
	FREG_URL: freg_url
} = import.meta.env
const authority = `https://login.microsoftonline.com/${tenant_id}`

const config = {
	auth: {
			clientId: client_id,
			authority: authority,
			clientSecret: client_secret
	}
};
const cca = new ConfidentialClientApplication(config)

let cachedToken: string | null = null;
let cachedTokenExpiresOn: number = 0;

const tokenRequest = {
	scopes: ["https://graph.microsoft.com/.default"] // or your API scope
};
*/

type TranscriptionMetadata= { filnavn: string, spraak: string, format: string, selectedFileName:string | null }

export async function sendFileToTranscription(filliste: Blob, metadata: TranscriptionMetadata, bearerToken?: string | null): Promise<Boolean> {
	
	if(!bearerToken)
		return false

	const decoded = jwtDecode(bearerToken)

	const user_upn = (decoded as any).upn	
	const datapakken = new FormData()
	datapakken.append('filer', filliste)
	datapakken.append('filnavn', metadata.filnavn)
	datapakken.append('spraak', metadata.spraak)
	datapakken.append('format', metadata.format)
	datapakken.append('upn', user_upn)

	const token = bearerToken // || await getToken();

	const response = await fetch(`${aiApiUri}/nbTranscript`, {
		method: 'POST',
		headers: {
			//'Content-Type': 'multipart/form-data',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(datapakken)
	})

	const resMessage = response.statusText
	console.log(resMessage)

	return response.status === 200
}
/*
export async function getToken(): Promise<string> {
		const now = Math.floor(Date.now() / 1000)
		if(cachedToken && now < cachedTokenExpiresOn -60){
			return cachedToken
		}
		let response = await cca.acquireTokenByClientCredential(tokenRequest)
    if (response && response.accessToken) {
			cachedToken = response.accessToken;
			cachedTokenExpiresOn = Math.floor((response.expiresOn as Date).getTime() / 1000);
			return response?.accessToken        
    } else {
        console.error("Could not get access token");
    }
		return ""		
}
	*/