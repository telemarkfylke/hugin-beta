import { jwtDecode } from 'jwt-decode'
import axios from 'axios'
const { VITE_AI_API_URI: aiApiUri } = import.meta.env

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

	const token = bearerToken

	const response = await axios.post(`${aiApiUri}/nbTranscript`, datapakken, {
    method: 'post',
    data: datapakken,
    headers: {
      'Content-Type': 'multipart/form-data',
      authorization: `Bearer ${token}`
    }
  })
		
	const resMessage = response.statusText
	console.log(resMessage)

	return response.status === 200
}