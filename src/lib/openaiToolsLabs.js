// Bibliotek for å håndtere API-kall til AZF-funksjoner
import axios from 'axios'
import { getHuginToken } from './useApi'
import { jwtDecode } from 'jwt-decode'

const { VITE_AI_API_URI: aiApiUri } = import.meta.env

export const nbTranscript = async (filliste, metadata) => {
  const accessToken =  await getHuginToken()
  const user_upn = jwtDecode(accessToken).upn

  const datapakken = new FormData()
  datapakken.append('filer', filliste)
  datapakken.append('filnavn', metadata.filnavn)
  datapakken.append('spraak', metadata.spraak)
  datapakken.append('format', metadata.format)
  datapakken.append('upn', user_upn)



	const r = await axios.post(`${aiApiUri}/nbTranscript`, datapakken, {
    method: 'post',
    data: datapakken,
    headers: {
      'Content-Type': 'multipart/form-data',
      authorization: `Bearer ${accessToken}`
    }
  })

	/*
  const r = await fetch(`${aiApiUri}/nbTranscript`, {
    method: 'post',
    data: datapakken,
    headers: {
      'Content-Type': 'multipart/form-data',
      authorization: `Bearer ${accessToken}`
    },
		body:JSON.stringify(datapakken)
  })
*/

  console.log('Venter på transcript: ')
  return JSON.stringify(r.data.data.text)
}
