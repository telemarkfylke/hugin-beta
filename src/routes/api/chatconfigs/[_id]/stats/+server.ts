import { json, type RequestHandler } from "@sveltejs/kit"
import { canUpdateChatConfig } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getChatConfigStore, getStatsStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"

const chatConfigStore = getChatConfigStore()
const statsStore = getStatsStore()

const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Parses shared from/to query params (ISO date strings), defaulting to "last 30 days" when absent.
// Used by both handlers below so the two stats views can't drift apart on date-range semantics.
function parseDateRange(searchParams: URLSearchParams): { from: Date; to: Date } {
	const toParam = searchParams.get("to")
	const fromParam = searchParams.get("from")

	const to = toParam ? new Date(toParam) : new Date()
	const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - DEFAULT_PERIOD_MS)

	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		throw new HTTPError(400, "Invalid from/to date")
	}
	return { from, to }
}

// Viewing stats is gated the same as editing the config (owner / agent maintainers on published
// bots / admin) - same audience, no separate "can view stats" role needed for this feature yet.
async function getAuthorizedChatConfig(chatConfigId: string, user: AuthenticatedPrincipal) {
	const chatConfig = await chatConfigStore.getChatConfig(chatConfigId)
	if (!chatConfig) {
		throw new HTTPError(404, "Chat config not found")
	}
	if (!canUpdateChatConfig(user, APP_CONFIG.APP_ROLES, chatConfig, chatConfig)) {
		throw new HTTPError(403, "Not authorized to view statistics for this chat configuration")
	}
	return chatConfig
}

// GET /api/chatconfigs/[_id]/stats?from=...&to=... - per-category question counts for the period.
// With a `category` param added, returns that one category's counts bucketed per day instead - lets
// a bot author drill into how a single category trends over the period, not just its period total.
const getCategoryStats: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const chatConfigId = requestEvent.params._id
	if (!chatConfigId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	await getAuthorizedChatConfig(chatConfigId, user)

	const { from, to } = parseDateRange(requestEvent.url.searchParams)
	const category = requestEvent.url.searchParams.get("category")

	if (category) {
		const stats = await statsStore.getCategoryStatsOverTime(chatConfigId, category, from, to)

		// "Ukategorisert" additionally gets a raw sampled list of AI-guessed topics, alongside (not
		// instead of) the counted trend above - see UncategorizedSample for why these aren't merged
		// into `stats` itself.
		if (category === FALLBACK_CATEGORY) {
			const samples = await statsStore.getUncategorizedSamples(chatConfigId, from, to)
			return {
				isAuthorized: true,
				response: json({ from: from.toISOString(), to: to.toISOString(), category, stats, samples })
			}
		}

		return {
			isAuthorized: true,
			response: json({ from: from.toISOString(), to: to.toISOString(), category, stats })
		}
	}

	const stats = await statsStore.getCategoryStats(chatConfigId, from, to)

	return {
		isAuthorized: true,
		response: json({ from: from.toISOString(), to: to.toISOString(), stats })
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, getCategoryStats)
}
