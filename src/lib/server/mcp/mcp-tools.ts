export type McpToolDefinition = {
	name: string
	description: string
	inputSchema: Record<string, unknown>
}

export const mcpToolToOpenAIResponsesTool = (tool: McpToolDefinition) => ({
	type: "function" as const,
	name: tool.name,
	description: tool.description,
	parameters: tool.inputSchema,
	strict: false as const
})

export const mcpToolToCompletionTool = (tool: McpToolDefinition) => ({
	type: "function" as const,
	function: {
		name: tool.name,
		description: tool.description,
		parameters: tool.inputSchema
	}
})

export const mcpToolToMistralTool = (tool: McpToolDefinition) => ({
	type: "function" as const,
	function: {
		name: tool.name,
		description: tool.description,
		parameters: tool.inputSchema
	}
})
