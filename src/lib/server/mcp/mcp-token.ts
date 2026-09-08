import { logger } from "@vestfoldfylke/loglady"
import type { McpServerConfig } from "./mcp-config"

logger.logConfig({ prefix: "hugin - mcp-token" })

type CachedToken = { value: string; expiresAtMs: number }
const EXPIRY_SKEW_MS = 60_000

export const createTokenProvider = (config: McpServerConfig): (() => Promise<string>) => {
	let cached: CachedToken | null = null

	return async (): Promise<string> => {
		const now = Date.now()
		if (cached && cached.expiresAtMs - EXPIRY_SKEW_MS > now) {
			return cached.value
		}

		const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`
		const body = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: config.clientId,
			client_secret: config.clientSecret,
			scope: config.scope
		})

		const response = await fetch(tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: body.toString()
		})

		if (!response.ok) {
			const detail = await response.text()
			logger.error("MCP token request failed: {status}", response.status)
			throw new Error(`MCP token request failed (${response.status}): ${detail}`)
		}

		const data = (await response.json()) as { access_token: string; expires_in: number }
		cached = { value: data.access_token, expiresAtMs: Date.now() + data.expires_in * 1000 }
		return cached.value
	}
}
