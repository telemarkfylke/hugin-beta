import { canUpdateChatConfig } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

const chatConfigStore = getChatConfigStore()

const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Parses shared from/to query params (ISO date strings), defaulting to "last 30 days" when absent.
// Shared by the stats view and the Excel export so the two can't drift apart on date-range semantics.
export function parseDateRange(searchParams: URLSearchParams): { from: Date; to: Date } {
	const toParam = searchParams.get("to")
	const fromParam = searchParams.get("from")

	const to = toParam ? new Date(toParam) : new Date()
	const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - DEFAULT_PERIOD_MS)

	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		throw new HTTPError(400, "Invalid from/to date")
	}
	return { from, to }
}

// Viewing stats (or exporting them) is gated the same as editing the config (owner / agent
// maintainers on published bots / admin) - same audience, no separate "can view stats" role needed
// for this feature yet.
export async function getAuthorizedChatConfig(chatConfigId: string, user: AuthenticatedPrincipal): Promise<ChatConfig> {
	const chatConfig = await chatConfigStore.getChatConfig(chatConfigId)
	if (!chatConfig) {
		throw new HTTPError(404, "Chat config not found")
	}
	if (!canUpdateChatConfig(user, APP_CONFIG.APP_ROLES, chatConfig, chatConfig)) {
		throw new HTTPError(403, "Not authorized to view statistics for this chat configuration")
	}
	return chatConfig
}
