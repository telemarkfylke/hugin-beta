import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"

// getMcpSources is principal-filtered (own sources + everyone's published ones, admin sees all -
// see canViewMcpSource) - mirrors IChatConfigStore.getChatConfigs. getMcpSource (singular, by id)
// deliberately is NOT filtered - callers fetch first, then apply canViewMcpSource/canEditMcpSource
// themselves once they have the source's own createdBy/type to check against (same split as
// IChatConfigStore.getChatConfig).
export interface IMcpSourceStore {
	getMcpSource(sourceId: string): Promise<McpSource | null>
	getMcpSources(principal: AuthenticatedPrincipal): Promise<McpSource[]>
	createMcpSource(source: NewMcpSource): Promise<McpSource>
	replaceMcpSource(sourceId: string, source: NewMcpSource): Promise<McpSource>
	deleteMcpSource(sourceId: string): Promise<void>
}
