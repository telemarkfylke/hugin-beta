import { env } from "$env/dynamic/private"

export async function getRagToken(userAccessToken: string): Promise<string> {
	const response = await fetch(
		`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
				client_id: env.ENTRA_CLIENT_ID ?? "",
				client_secret: env.ENTRA_CLIENT_SECRET ?? "",
				assertion: userAccessToken,
				scope: env.RAGSERVICE_SCOPE ?? "",
				requested_token_use: "on_behalf_of"
			})
		}
	)

	if (!response.ok) {
		const err = await response.text()
		throw new Error(`OBO token-bytte feilet: ${err}`)
	}

	const data = await response.json()
	return data.access_token as string
}
