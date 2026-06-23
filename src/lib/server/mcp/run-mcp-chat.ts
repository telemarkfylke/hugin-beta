import { Mistral } from "@mistralai/mistralai"
import { logger } from "@vestfoldfylke/loglady"
import OpenAI from "openai"
import { env } from "$env/dynamic/private"
import { createSse } from "$lib/streaming"
import type { ChatConfig, ChatRequest } from "$lib/types/chat"
import { runMcpAgenticLoop, type ToolTurnDriver } from "./agentic-loop"
import { createLitellmToolDriver } from "./drivers/litellm-tool-driver"
import { createMistralToolDriver } from "./drivers/mistral-tool-driver"
import { createOpenAIToolDriver } from "./drivers/openai-tool-driver"
import { getSharepointMcpClient } from "./mcp-client"

logger.logConfig({ prefix: "hugin - mcp-chat" })

const MCP_UNAVAILABLE_MESSAGE = "SharePoint-verktøyene (MCP) er ikke tilgjengelige akkurat nå. Kontakt en administrator hvis problemet vedvarer."

export const configHasMcpTool = (config: ChatConfig): boolean => {
	return Boolean(config.tools?.some((tool) => tool.type === "mcp"))
}

/**
 * Returns a stream that emits a single user-facing `response.error` event and closes.
 * Used when MCP setup fails (unconfigured server, missing API key, connection/discovery failure)
 * so the chat degrades gracefully instead of crashing the request with a 500.
 */
export const mcpUnavailableStream = (message: string = MCP_UNAVAILABLE_MESSAGE): ReadableStream<Uint8Array> => {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(createSse({ event: "response.error", data: { code: "mcp_unavailable", message } }))
			controller.close()
		}
	})
}

export const runMcpChat = async (chatRequest: ChatRequest): Promise<ReadableStream<Uint8Array>> => {
	try {
		const mcpClient = await getSharepointMcpClient()
		if (!mcpClient) {
			logger.warn("MCP chat requested but SharePoint MCP server is not configured")
			return mcpUnavailableStream()
		}
		const tools = await mcpClient.listTools()
		const { vendorId, project } = chatRequest.config

		let driver: ToolTurnDriver
		if (vendorId === "OPENAI") {
			const apiKey = env[`OPENAI_API_KEY_PROJECT_${project}`]
			if (!apiKey) throw new Error(`No OpenAI API key for project ${project}`)
			driver = createOpenAIToolDriver(new OpenAI({ apiKey }), chatRequest, tools)
		} else if (vendorId === "MISTRAL") {
			const apiKey = env[`MISTRAL_API_KEY_PROJECT_${project}`]
			if (!apiKey) throw new Error(`No Mistral API key for project ${project}`)
			driver = createMistralToolDriver(new Mistral({ apiKey }), chatRequest, tools)
		} else if (vendorId === "LITELLM") {
			if (!env.LITELLM_BASE_URL) throw new Error("LITELLM_BASE_URL environment variable is not set")
			driver = createLitellmToolDriver(new OpenAI({ baseURL: env.LITELLM_BASE_URL, apiKey: env.LITELLM_API_KEY || "no-key" }), chatRequest, tools)
		} else {
			throw new Error(`MCP is not supported for vendor ${vendorId}`)
		}

		return runMcpAgenticLoop(driver, mcpClient)
	} catch (error) {
		logger.errorException(error, "Failed to set up MCP chat")
		return mcpUnavailableStream()
	}
}
