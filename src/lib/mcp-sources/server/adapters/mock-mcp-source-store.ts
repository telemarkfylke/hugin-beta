import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"
import type { IMcpSourceStore } from "./interface"

// Deliberately empty - an earlier seed entry here (scoped to a real tester's own scratch
// SharePoint folder) turned into a confusing, silently-present "phantom" data source in MOCK_DB
// mode, indistinguishable in the UI from one someone actually configured. Mock stores should never
// pre-seed data shaped like something a real person would knowingly create.
let mockMcpSources: McpSource[] = []

export class MockMcpSourceStore implements IMcpSourceStore {
	async getMcpSource(sourceId: string): Promise<McpSource | null> {
		return mockMcpSources.find((source) => source._id === sourceId) ?? null
	}

	async getMcpSources(): Promise<McpSource[]> {
		return mockMcpSources
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
