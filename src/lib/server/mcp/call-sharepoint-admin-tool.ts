import { logger } from "@vestfoldfylke/loglady"
import { HTTPError } from "../middleware/http-error"
import { getSharepointMcpClient } from "./mcp-client"

// Used by the admin-only SharePoint browse/lists routes. Turns connect/call failures into a readable
// HTTPError instead of a bare 500 "Internal Server Error". The real error is logged here (and, for
// connect failures, with its cause in mcp-client.ts).
export const callSharepointAdminTool = async (toolName: string, args: Record<string, unknown>): Promise<string> => {
	let client: Awaited<ReturnType<typeof getSharepointMcpClient>>
	try {
		client = await getSharepointMcpClient()
	} catch (error) {
		logger.errorException(error, "[mcp] Could not connect to SharePoint MCP for admin tool {toolName}", toolName)
		throw new HTTPError(502, "Could not reach the SharePoint service")
	}
	if (!client) {
		throw new HTTPError(503, "SharePoint MCP is not configured")
	}
	try {
		return await client.callTool(toolName, args)
	} catch (error) {
		logger.errorException(error, "[mcp] SharePoint admin tool {toolName} failed", toolName)
		throw new HTTPError(502, "The SharePoint service returned an error")
	}
}
