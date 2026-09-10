import type { NewWebsiteSource, WebsiteSource } from "$lib/types/website-source"
import type { IWebsiteSourceStore } from "./interface"

let mockWebsiteSources: WebsiteSource[] = [
	{
		_id: "web-1000",
		name: "Farte.no - Kollektivtransport",
		entries: [{ value: "https://www.farte.no/kollektiv/", matchType: "prefix" }],
		createdBy: { id: "system" },
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	}
]

export class MockWebsiteSourceStore implements IWebsiteSourceStore {
	async getWebsiteSource(sourceId: string): Promise<WebsiteSource | null> {
		return mockWebsiteSources.find((source) => source._id === sourceId) ?? null
	}

	async getWebsiteSources(): Promise<WebsiteSource[]> {
		return mockWebsiteSources
	}

	async createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource> {
		const newSource: WebsiteSource = { ...source, _id: Date.now().toString() }
		mockWebsiteSources.push(newSource)
		return newSource
	}

	async replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource> {
		const existing = mockWebsiteSources.find((s) => s._id === sourceId)
		if (!existing) throw new Error("WebsiteSource not found")
		Object.assign(existing, source)
		return existing
	}

	async deleteWebsiteSource(sourceId: string): Promise<void> {
		mockWebsiteSources = mockWebsiteSources.filter((source) => source._id !== sourceId)
	}
}
