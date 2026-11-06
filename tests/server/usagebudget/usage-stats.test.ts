import { describe, expect, it } from "vitest"
import { getRateLimiter } from "$lib/server/db/get-db"
import { BUDGET_KEY_PREFIX, DAY_MS } from "$lib/usagebudget/server/usage-budget"
import { distributeUsage, getTodaysUsage, USAGE_BUCKET_BOUNDS } from "$lib/usagebudget/server/usage-stats"

describe("distributeUsage", () => {
	it("puts each value in the bucket whose lower bound it reaches, the last one open-ended", () => {
		const { buckets, active, totalUsd } = distributeUsage([0, 0.005, 0.01, 0.3, 1, 1.5, 12, 500])
		const counts = Object.fromEntries(buckets.map((b) => [b.fromUsd, b.count]))
		expect(counts).toEqual({ 0: 2, 0.01: 1, 0.05: 0, 0.1: 0, 0.25: 1, 0.5: 0, 1: 2, 2: 0, 5: 0, 10: 2 })
		expect(buckets.at(-1)).toMatchObject({ fromUsd: 10, toUsd: null, totalUsd: 512 })
		expect(active).toBe(8)
		expect(totalUsd).toBeCloseTo(514.815, 2)
	})

	it("keeps negative counters out of the buckets, the active count and the total", () => {
		const result = distributeUsage([-0.02, 0.5, -0.01])
		expect(result.negative).toEqual({ count: 2, totalUsd: -0.03 })
		expect(result.active).toBe(1)
		expect(result.totalUsd).toBe(0.5)
	})

	it("always returns every bucket, empty or not", () => {
		const { buckets, active } = distributeUsage([])
		expect(buckets).toHaveLength(USAGE_BUCKET_BOUNDS.length)
		expect(buckets.every((b) => b.count === 0)).toBe(true)
		expect(active).toBe(0)
	})
})

describe("getTodaysUsage", () => {
	it("reads today's user and anonymous-bot day counters, and nothing else", async () => {
		const before = await getTodaysUsage()
		const rateLimiter = getRateLimiter()
		await rateLimiter.add(`${BUDGET_KEY_PREFIX.userDay}stats-user-a`, 0.3, DAY_MS)
		await rateLimiter.add(`${BUDGET_KEY_PREFIX.userDay}stats-user-b`, 3, DAY_MS)
		await rateLimiter.add(`${BUDGET_KEY_PREFIX.userHour}stats-user-a`, 0.3, 60 * 60_000)
		await rateLimiter.add(`${BUDGET_KEY_PREFIX.anonBotDay}stats-bot`, 1, DAY_MS)

		const after = await getTodaysUsage()
		expect(after.users.active - before.users.active).toBe(2)
		expect(after.users.totalUsd - before.users.totalUsd).toBeCloseTo(3.3)
		expect(after.anonymousEmbedBots.active - before.anonymousEmbedBots.active).toBe(1)
		expect(after.since.getTime() % DAY_MS).toBe(0)
	})
})
