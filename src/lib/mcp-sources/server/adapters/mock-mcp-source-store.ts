import { canViewMcpSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"
import type { IMcpSourceStore } from "./interface"

// Deliberately empty - an earlier seed entry here (scoped to a real tester's own scratch
// SharePoint folder) turned into a confusing, silently-present "phantom" data source in MOCK_DB
// mode, indistinguishable in the UI from one someone actually configured. Mock stores should never
// pre-seed data shaped like something a real person would knowingly create.
let mockMcpSources: McpSource[] = []

// Same reasoning as MongoMcpSourceStore's normalizeMcpSource: a source object created (in memory,
// here) before `lists` existed on McpSourceConfig and still sitting in this module-scoped array
// across a dev-server session is missing the field entirely, not holding an empty array - reading
// it as-is would crash callers that trust McpSource's `lists: string[]` (McpSourceList.svelte,
// McpSourceForm.svelte).
const normalizeMcpSource = (source: McpSource): McpSource => (source.server === "sharepoint" && source.lists === undefined ? { ...source, lists: [] } : source)

export class MockMcpSourceStore implements IMcpSourceStore {
	async getMcpSource(sourceId: string): Promise<McpSource | null> {
		const source = mockMcpSources.find((source) => source._id === sourceId)
		return source ? normalizeMcpSource(source) : null
	}

	async getMcpSources(principal: AuthenticatedPrincipal): Promise<McpSource[]> {
		return mockMcpSources.filter((source) => canViewMcpSource(source, principal, APP_CONFIG.APP_ROLES)).map(normalizeMcpSource)
	}

	async createMcpSource(source: NewMcpSource): Promise<McpSource> {
		const newSource: McpSource = { ...source, _id: Date.now().toString() }
		mockMcpSources.push(newSource)
		return newSource
	}

	async replaceMcpSource(sourceId: string, source: NewMcpSource): Promise<McpSource> {
		const index = mockMcpSources.findIndex((s) => s._id === sourceId)
		if (index === -1) throw new Error("McpSource not found")
		const updated: McpSource = { ...source, _id: sourceId }
		mockMcpSources[index] = updated
		return updated
	}

	async deleteMcpSource(sourceId: string): Promise<void> {
		mockMcpSources = mockMcpSources.filter((source) => source._id !== sourceId)
	}
}
