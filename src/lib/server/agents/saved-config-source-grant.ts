import { canPromptConfig } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

export type SourceGrant = (type: "website" | "mcp", sourceId: string) => boolean

// /api/chat gets its config from the client, so a dataSources entry there proves nothing. A source the
// user can't see themselves is still usable when the SAVED assistant references it and the user may
// prompt that assistant - that's how a published assistant shares its creator's private source.
export const sourceGrantFromSavedConfig = (savedConfig: ChatConfig | null, user: AuthenticatedPrincipal, appConfig: AppConfig): SourceGrant => {
	if (!savedConfig || !canPromptConfig(user, appConfig, savedConfig)) {
		return () => false
	}
	const granted = new Set(
		(savedConfig.dataSources ?? []).flatMap((source) => {
			if (source.type === "mcp") return [`mcp:${source.sourceId}`]
			if (source.type === "website") return [`website:${source.id}`]
			return []
		})
	)
	return (type, sourceId) => granted.has(`${type}:${sourceId}`)
}

export const loadSavedConfigSourceGrant = async (configId: string, user: AuthenticatedPrincipal): Promise<SourceGrant> => {
	if (!configId) {
		return () => false
	}
	// A malformed id makes the Mongo store's ObjectId constructor throw - treat it as "not saved"
	const savedConfig = await getChatConfigStore()
		.getChatConfig(configId)
		.catch(() => null)
	return sourceGrantFromSavedConfig(savedConfig, user, APP_CONFIG)
}
