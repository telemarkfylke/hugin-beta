import { Mistral } from "@mistralai/mistralai"
import OpenAI from "openai"
import { env } from "$env/dynamic/private"
import type { ChatRequest } from "$lib/types/chat"
import type { ToolTurnDriver } from "./agentic-loop"
import { createLitellmToolDriver } from "./drivers/litellm-tool-driver"
import { createMistralToolDriver } from "./drivers/mistral-tool-driver"
import { createOpenAIToolDriver } from "./drivers/openai-tool-driver"
import type { McpToolDefinition } from "./mcp-tools"

// Shared per-vendor driver selection for agentic tool-calling - used by both the MCP and website
// tool-calling paths (see run-agentic-chat.ts), which are otherwise identical except for which
// { listTools, callTool } client backs the tool calls. Previously duplicated near-verbatim between
// run-mcp-chat.ts and run-website-chat.ts.
export const createToolDriverForVendor = (chatRequest: ChatRequest, tools: McpToolDefinition[]): ToolTurnDriver => {
	const { vendorId, project } = chatRequest.config

	if (vendorId === "OPENAI") {
		const apiKey = env[`OPENAI_API_KEY_PROJECT_${project}`]
		if (!apiKey) throw new Error(`No OpenAI API key for project ${project}`)
		return createOpenAIToolDriver(new OpenAI({ apiKey }), chatRequest, tools)
	}
	if (vendorId === "MISTRAL") {
		const apiKey = env[`MISTRAL_API_KEY_PROJECT_${project}`]
		if (!apiKey) throw new Error(`No Mistral API key for project ${project}`)
		return createMistralToolDriver(new Mistral({ apiKey }), chatRequest, tools)
	}
	if (vendorId === "LITELLM") {
		if (!env.LITELLM_BASE_URL) throw new Error("LITELLM_BASE_URL environment variable is not set")
		return createLitellmToolDriver(new OpenAI({ baseURL: env.LITELLM_BASE_URL, apiKey: env.LITELLM_API_KEY || "no-key" }), chatRequest, tools)
	}
	throw new Error(`Agentic tool-calling is not supported for vendor ${vendorId}`)
}
