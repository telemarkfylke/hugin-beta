import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"

// No per-item access control (unlike IChatConfigStore) - same single shared gate as MCP
// SharePoint today (see canUseMcpSharepoint), regardless of which `server` a given source has.
export interface IMcpSourceStore {
	getMcpSource(sourceId: string): Promise<McpSource | null>
	getMcpSources(): Promise<McpSource[]>
	createMcpSource(source: NewMcpSource): Promise<McpSource>
	replaceMcpSource(sourceId: string, source: NewMcpSource): Promise<McpSource>
	deleteMcpSource(sourceId: string): Promise<void>
}
