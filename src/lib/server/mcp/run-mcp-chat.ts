import { Mistral } from "@mistralai/mistralai"
import OpenAI from "openai"
import { env } from "$env/dynamic/private"
import type { ChatConfig, ChatRequest } from "$lib/types/chat"
import { runMcpAgenticLoop, type ToolTurnDriver } from "./agentic-loop"
import { createLitellmToolDriver } from "./drivers/litellm-tool-driver"
import { createMistralToolDriver } from "./drivers/mistral-tool-driver"
import { createOpenAIToolDriver } from "./drivers/openai-tool-driver"
import { getSharepointMcpClient } from "./mcp-client"

export const configHasMcpTool = (config: ChatConfig): boolean => {
	return Boolean(config.tools?.some((tool) => tool.type === "mcp"))
}

export const runMcpChat = async (chatRequest: ChatRequest): Promise<ReadableStream<Uint8Array>> => {
	const mcpClient = await getSharepointMcpClient()
	if (!mcpClient) {
		throw new Error("SharePoint MCP server is not configured")
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
		driver = createLitellmToolDriver(new OpenAI({ baseURL: env.LITELLM_BASE_URL, apiKey: env.LITELLM_API_KEY || "no-key" }), chatRequest, tools)
	} else {
		throw new Error(`MCP is not supported for vendor ${vendorId}`)
	}

	return runMcpAgenticLoop(driver, mcpClient)
}
