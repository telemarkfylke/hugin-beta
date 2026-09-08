import { env } from "$env/dynamic/private"

export type McpServerConfig = {
	url: string
	clientId: string
	clientSecret: string
	tenantId: string
	scope: string
}

export const getMcpConfig = (): McpServerConfig | null => {
	if (env.MCP_SHAREPOINT_ENABLED !== "true") {
		return null
	}
	const url = env.MCP_SHAREPOINT_URL
	const clientId = env.MCP_SHAREPOINT_CLIENT_ID
	const clientSecret = env.MCP_SHAREPOINT_CLIENT_SECRET
	const tenantId = env.MCP_SHAREPOINT_TENANT_ID
	const scope = env.MCP_SHAREPOINT_SCOPE
	if (!url || !clientId || !clientSecret || !tenantId || !scope) {
		return null
	}
	return { url, clientId, clientSecret, tenantId, scope }
}
