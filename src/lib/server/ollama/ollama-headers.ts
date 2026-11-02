// The Ollama behind ki.telemarkfylke.no sits behind Traefik basic auth (POC - to be replaced by a proper
// service key). fetch rejects credentials in the URL, so they have to go in a header.
export const buildOllamaHeaders = (basicAuth: string | undefined): Record<string, string> => {
	if (!basicAuth) {
		return {}
	}
	return { Authorization: `Basic ${Buffer.from(basicAuth).toString("base64")}` }
}
