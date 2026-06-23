import { describe, expect, it } from "vitest"
import { type McpToolDefinition, mcpToolToCompletionTool, mcpToolToMistralTool, mcpToolToOpenAIResponsesTool } from "../../../src/lib/server/mcp/mcp-tools"

const tool: McpToolDefinition = {
	name: "Search_SharePoint",
	description: "Full-text KQL search",
	inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
}

describe("mcp tool adapters", () => {
	it("maps to OpenAI Responses function tool", () => {
		expect(mcpToolToOpenAIResponsesTool(tool)).toEqual({
			type: "function",
			name: "Search_SharePoint",
			description: "Full-text KQL search",
			parameters: tool.inputSchema,
			strict: false
		})
	})

	it("maps to Chat Completions tool", () => {
		expect(mcpToolToCompletionTool(tool)).toEqual({
			type: "function",
			function: { name: "Search_SharePoint", description: "Full-text KQL search", parameters: tool.inputSchema }
		})
	})

	it("maps to Mistral function tool", () => {
		expect(mcpToolToMistralTool(tool)).toEqual({
			type: "function",
			function: { name: "Search_SharePoint", description: "Full-text KQL search", parameters: tool.inputSchema }
		})
	})
})
