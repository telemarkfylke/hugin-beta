import type { NewWebsiteSource, WebsiteSource } from "$lib/types/website-source"

// No per-item access control (unlike IChatConfigStore) - same single shared gate as MCP
// SharePoint today (see canUseWebsiteDataSource), not ragservice's access-row system. Any
// employee/admin can see and select any website source.
export interface IWebsiteSourceStore {
	getWebsiteSource(sourceId: string): Promise<WebsiteSource | null>
	getWebsiteSources(): Promise<WebsiteSource[]>
	createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource>
	replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource>
	deleteWebsiteSource(sourceId: string): Promise<void>
}
