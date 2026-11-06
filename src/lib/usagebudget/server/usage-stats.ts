import { getRateLimiter } from "$lib/server/db/get-db"
import type { TodaysUsage, UsageDistribution } from "$lib/usagebudget/types"
import { BUDGET_KEY_PREFIX, DAY_MS } from "./usage-budget"

// Lower bounds in USD, each bucket running up to the next one (the last is open-ended). Fixed rather
// than derived from the budgets, so the picture stays comparable from day to day.
export const USAGE_BUCKET_BOUNDS = [0, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] as const

const round = (usd: number) => Math.round(usd * 100) / 100

export const distributeUsage = (counts: number[]): UsageDistribution => {
	const buckets = USAGE_BUCKET_BOUNDS.map((fromUsd, index) => ({ fromUsd, toUsd: USAGE_BUCKET_BOUNDS[index + 1] ?? null, count: 0, totalUsd: 0 }))
	const negative = { count: 0, totalUsd: 0 }
	for (const usd of counts) {
		if (usd < 0) {
			negative.count++
			negative.totalUsd += usd
			continue
		}
		// The last bucket whose lower bound the value reaches - always found, since usd >= 0
		const bucket = buckets.findLast((b) => usd >= b.fromUsd)
		if (bucket) {
			bucket.count++
			bucket.totalUsd += usd
		}
	}
	const positive = buckets.reduce((sum, b) => sum + b.totalUsd, 0)
	return {
		active: counts.length - negative.count,
		totalUsd: round(positive),
		buckets: buckets.map((b) => ({ ...b, totalUsd: round(b.totalUsd) })),
		negative: { count: negative.count, totalUsd: round(negative.totalUsd) }
	}
}

// Straight from the day counters the usage budget already keeps - no extra writes, and nothing per
// person leaves this function, only counts and sums.
export const getTodaysUsage = async (): Promise<TodaysUsage> => {
	const rateLimiter = getRateLimiter()
	const [users, bots] = await Promise.all([rateLimiter.listCounts(BUDGET_KEY_PREFIX.userDay, DAY_MS), rateLimiter.listCounts(BUDGET_KEY_PREFIX.anonBotDay, DAY_MS)])
	return {
		since: new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS),
		users: distributeUsage(users),
		anonymousEmbedBots: distributeUsage(bots)
	}
}
