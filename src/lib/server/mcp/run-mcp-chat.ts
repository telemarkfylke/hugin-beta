import { createSse } from "$lib/streaming"
import type { ChatConfig } from "$lib/types/chat"

const MCP_UNAVAILABLE_MESSAGE = "SharePoint-verktøyene (MCP) er ikke tilgjengelige akkurat nå. Kontakt en administrator hvis problemet vedvarer."

export const configHasMcpTool = (config: ChatConfig): boolean => {
	return Boolean(config.tools?.some((tool) => tool.type === "mcp"))
}

/**
 * Returns a stream that emits a single user-facing `response.error` event and closes.
 * Used when MCP (or website) tool-calling setup fails (unconfigured server, missing API key,
 * connection/discovery failure) so the chat degrades gracefully instead of crashing the request
 * with a 500. Shared across MCP and website tool-calling (see run-agentic-chat.ts) - not
 * MCP-specific despite living in this file, kept here to avoid unrelated import churn.
 */
export const mcpUnavailableStream = (message: string = MCP_UNAVAILABLE_MESSAGE): ReadableStream<Uint8Array> => {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(createSse({ event: "response.error", data: { code: "mcp_unavailable", message } }))
			controller.close()
		}
	})
}
