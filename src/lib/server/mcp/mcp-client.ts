import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { logger } from "@vestfoldfylke/loglady"
import { getMcpConfig } from "./mcp-config"
import { createTokenProvider } from "./mcp-token"
import type { McpToolDefinition } from "./mcp-tools"

logger.logConfig({ prefix: "hugin - mcp-client" })

// The mcp-sharepoint server's own Microsoft Graph client can take up to ~60s internally before it
// gives up (per its integration handover doc). This must stay comfortably above that, or Hugin's
// client-side abort races the server's own timeout and usually loses - producing a false failure
// for a call the server would have completed a few seconds later.
const MCP_CALL_TIMEOUT_MS = 70_000

export interface McpClient {
	listTools(): Promise<McpToolDefinition[]>
	callTool(name: string, args: Record<string, unknown>): Promise<string>
}

// Exported for unit testing.
// The parameter type uses an index signature so callers can pass the SDK's full discriminated-union
// content array (which includes extra fields like `data`, `mimeType`, etc.) without needing a cast.
export const flattenToolResult = (result: { content?: Array<{ type: string; text?: string; [key: string]: unknown }> }): string => {
	if (!result.content) {
		return ""
	}
	return result.content
		.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text as string)
		.join("")
}

let clientPromise: Promise<McpClient | null> | null = null

const connect = async (): Promise<McpClient | null> => {
	const config = getMcpConfig()
	if (!config) {
		logger.info("MCP not configured; SharePoint tools unavailable")
		return null
	}
	const getToken = createTokenProvider(config)

	// The SDK's `fetch` option (type FetchLike) is the correct hook for per-request
	// header injection in v1.29.0. It intercepts every HTTP call the transport makes,
	// letting us attach a fresh bearer token without needing OAuthClientProvider.
	const transport = new StreamableHTTPClientTransport(new URL(config.url), {
		fetch: async (input, init) => {
			const token = await getToken()
			const headers = new Headers(init?.headers)
			headers.set("Authorization", `Bearer ${token}`)
			return fetch(input, { ...init, headers })
		}
	})

	const sdkClient = new Client({ name: "hugin", version: "1.0.0" }, { capabilities: {} })
	// Cast required: StreamableHTTPClientTransport.sessionId getter returns `string | undefined`,
	// which conflicts with Transport's `sessionId?: string` under exactOptionalPropertyTypes.
	// This is a type-level incompatibility in the SDK (v1.29.0) - the runtime behaviour is correct.
	await sdkClient.connect(transport as import("@modelcontextprotocol/sdk/shared/transport.js").Transport)

	let toolsCache: McpToolDefinition[] | null = null

	return {
		async listTools() {
			if (toolsCache) {
				return toolsCache
			}
			const { tools } = await sdkClient.listTools()
			toolsCache = tools.map((t) => ({
				name: t.name,
				description: t.description ?? "",
				inputSchema: t.inputSchema as Record<string, unknown>
			}))
			logger.info("MCP tools discovered: {count}", toolsCache.length)
			return toolsCache
		},
		async callTool(name, args) {
			logger.info("MCP tool call: {name}", name)
			// resultSchema is optional; pass undefined to reach the options argument (3rd param).
			const result = await sdkClient.callTool({ name, arguments: args }, undefined, { timeout: MCP_CALL_TIMEOUT_MS })
			const text = flattenToolResult(result as { content?: Array<{ type: string; text?: string }> })
			// Tool failures come back as HTTP 200 + isError: true + the message in content[].text,
			// not as a rejected request - see the mcp-sharepoint integration handover doc. Throwing
			// here routes the failure through agentic-loop.ts's existing executeToolCall catch block,
			// which already turns a thrown error into a { isError: true } ToolResult fed back to the
			// model and a response.tool_result { status: "error" } SSE event - no changes needed there.
			if ((result as { isError?: boolean }).isError) {
				throw new Error(text || `MCP tool ${name} returned an error`)
			}
			return text
		}
	}
}

export const getSharepointMcpClient = (): Promise<McpClient | null> => {
	if (!clientPromise) {
		clientPromise = connect().catch((error: unknown) => {
			logger.errorException(error, "Failed to connect to SharePoint MCP server")
			clientPromise = null
			throw error
		})
	}
	return clientPromise
}
