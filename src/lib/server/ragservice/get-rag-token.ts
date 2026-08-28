import { env } from "$env/dynamic/private"

export async function getRagToken(): Promise<string> {
	const response = await fetch(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: env.ENTRA_CLIENT_ID ?? "",
			client_secret: env.ENTRA_CLIENT_SECRET ?? "",
			scope: env.RAGSERVICE_SCOPE ?? ""
		})
	})

	if (!response.ok) {
		const err = await response.text()
		throw new Error(`Klarte ikke å hente tilgangstoken: ${err}`)
	}

	const data = await response.json()
	return data.access_token as string
}
