import { logger } from "@vestfoldfylke/loglady"
import type { ChatRequest } from "$lib/types/chat"
import { runMcpAgenticLoop } from "./agentic-loop"
import { createToolDriverForVendor } from "./create-tool-driver"
import type { McpClient } from "./mcp-client"
import { mcpUnavailableStream } from "./run-mcp-chat"

// Shared "run one turn of agentic tool-calling chat" - used for MCP, website browsing, and any
// combination of the two (see combined-tool-client.ts). Every MCP-vs-website-specific difference
// is already captured in `client` (which tools exist, how calls are validated/scoped) and
// createToolDriverForVendor (which vendor API to speak) - this function itself has no
// source-specific logic at all.
export const runAgenticToolChat = async (chatRequest: ChatRequest, client: McpClient): Promise<ReadableStream<Uint8Array>> => {
	const tools = await client.listTools()
	const driver = createToolDriverForVendor(chatRequest, tools)
	return runMcpAgenticLoop(driver, client)
}

// Same graceful-degradation shape as the old per-source runMcpChat/runWebsiteChat - any setup
// failure (missing vendor API key, a transport error from listTools(), etc.) becomes a
// user-facing response.error stream instead of a 500.
export const runAgenticToolChatOrDegrade = async (chatRequest: ChatRequest, client: McpClient, unavailableMessage?: string): Promise<ReadableStream<Uint8Array>> => {
	try {
		return await runAgenticToolChat(chatRequest, client)
	} catch (error) {
		logger.errorException(error, "[agentic-chat] Failed to set up agentic tool chat")
		return mcpUnavailableStream(unavailableMessage)
	}
}
