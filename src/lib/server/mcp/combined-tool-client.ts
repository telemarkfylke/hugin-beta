import type { McpClient } from "./mcp-client"
import type { McpToolDefinition } from "./mcp-tools"

// Combines several tool-calling clients (e.g. a scoped SharePoint client + the website
// browse-tool client) into one, so a bot with multiple kinds of data sources active gets ONE
// agentic loop with the union of every client's tools, instead of only one kind winning. Assumes
// tool names never collide across clients (true today: SharePoint's tool names and
// "browse_website" don't overlap, and a future MCP server would presumably bring its own
// distinctly-named tools too).
export const createCombinedToolClient = (clients: McpClient[]): McpClient => {
	// Populated by listTools() - callTool() needs this to know which client owns a given tool
	// name. listTools() is always called once per chat turn before any callTool() (see
	// run-agentic-chat.ts), so this is populated by the time it's needed.
	let ownerByToolName = new Map<string, McpClient>()

	return {
		async listTools(): Promise<McpToolDefinition[]> {
			const allTools: McpToolDefinition[] = []
			const nextOwnerByToolName = new Map<string, McpClient>()
			for (const client of clients) {
				const tools = await client.listTools()
				for (const tool of tools) {
					nextOwnerByToolName.set(tool.name, client)
					allTools.push(tool)
				}
			}
			ownerByToolName = nextOwnerByToolName
			return allTools
		},
		async callTool(name: string, args: Record<string, unknown>): Promise<string> {
			const owner = ownerByToolName.get(name)
			if (!owner) {
				throw new Error(`Unknown tool: ${name}`)
			}
			return owner.callTool(name, args)
		}
	}
}
