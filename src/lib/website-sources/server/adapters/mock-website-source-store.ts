import { canViewWebsiteSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { NewWebsiteSource, WebsiteSource } from "$lib/types/website-source"
import type { IWebsiteSourceStore } from "./interface"

// Deliberately empty - see mock-mcp-source-store.ts's identical comment: mock stores should never
// pre-seed data shaped like something a real person would knowingly create, since it's
// indistinguishable in the UI from an actual configured source once MOCK_DB reaches a shared
// (not just single-developer) environment.
let mockWebsiteSources: WebsiteSource[] = []

export class MockWebsiteSourceStore implements IWebsiteSourceStore {
	async getWebsiteSource(sourceId: string): Promise<WebsiteSource | null> {
		return mockWebsiteSources.find((source) => source._id === sourceId) ?? null
	}

	async getWebsiteSources(principal: AuthenticatedPrincipal): Promise<WebsiteSource[]> {
		return mockWebsiteSources.filter((source) => canViewWebsiteSource(source, principal, APP_CONFIG.APP_ROLES))
	}

	async createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource> {
		const newSource: WebsiteSource = { ...source, _id: Date.now().toString() }
		mockWebsiteSources.push(newSource)
		return newSource
	}

	async replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource> {
		const index = mockWebsiteSources.findIndex((s) => s._id === sourceId)
		if (index === -1) throw new Error("WebsiteSource not found")
		const updated: WebsiteSource = { ...source, _id: sourceId }
		mockWebsiteSources[index] = updated
		return updated
	}

	async deleteWebsiteSource(sourceId: string): Promise<void> {
		mockWebsiteSources = mockWebsiteSources.filter((source) => source._id !== sourceId)
	}
}
