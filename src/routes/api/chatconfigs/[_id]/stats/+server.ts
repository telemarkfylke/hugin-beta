import { json, type RequestHandler } from "@sveltejs/kit"
import { getStatsStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getAuthorizedChatConfig, parseDateRange } from "./shared"

const statsStore = getStatsStore()

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
