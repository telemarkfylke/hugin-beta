import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { NewWebsiteSource, WebsiteSource } from "$lib/types/website-source"

// getWebsiteSources is principal-filtered (own sources + everyone's published ones, admin sees all
// - see canViewWebsiteSource) - mirrors IChatConfigStore.getChatConfigs. getWebsiteSource (singular,
// by id) deliberately is NOT filtered - callers fetch first, then apply
// canViewWebsiteSource/canEditWebsiteSource themselves once they have the source's own
// createdBy/type to check against (same split as IChatConfigStore.getChatConfig).
export interface IWebsiteSourceStore {
	getWebsiteSource(sourceId: string): Promise<WebsiteSource | null>
	getWebsiteSources(principal: AuthenticatedPrincipal): Promise<WebsiteSource[]>
	createWebsiteSource(source: NewWebsiteSource): Promise<WebsiteSource>
	replaceWebsiteSource(sourceId: string, source: NewWebsiteSource): Promise<WebsiteSource>
	deleteWebsiteSource(sourceId: string): Promise<void>
}
