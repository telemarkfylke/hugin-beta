import z from "zod"
import { AFFILIATIONS, type Affiliation } from "$lib/types/authentication"

// Usage limits and model prices live in the database (collections "usage-limits" and "model-prices",
// edited on /admin/ratelimits), so prod and beta - same code, separate databases - can each have their
// own. The code only holds the strict emergency floor in $lib/usagebudget/server/usage-limits, used
// for any value the DB doesn't have (or has in a broken shape) - never "no limit".

// USD per 1M tokens, straight from the vendor's price list
export type ModelPrice = {
	inputPerMillion: number
	outputPerMillion: number
}

export type HourDayBudget = {
	perHourUsd: number
	perDayUsd: number
}

export type UsageLimits = {
	// Per user, by brukertype (affiliation). A user with several gets the most generous one, a user with
	// none gets the student budget. Hugin roles (admin etc.) deliberately play no part - they decide what
	// you may change in Hugin, not how much you may use.
	budgets: Record<Affiliation, HourDayBudget>
	// Per anonymously embedded assistant, shared by all its visitors
	anonymousEmbed: HourDayBudget
	// Calls in flight per user - bounds how far parallel requests can overshoot the budget
	maxConcurrentCalls: number
	// Billed per web search call by the vendor, on top of the tokens
	webSearchCallPriceUsd: number
	// Message-count limits on the anonymous embed, defaults for every bot - a bot's own
	// ChatConfig.rateLimitPerIpPerMinute/PerIpPerDay/PerBotPerDay still overrides them
	embedRateLimits: {
		perIpPerMinute: number
		perIpPerDay: number
		// null = no shared per-bot cap (the deliberate default, see the embed chat route)
		perBotPerDay: number | null
	}
}

export type UpdatedBy = { id: string; name: string }

export type UsageLimitsSettings = {
	limits: UsageLimits
	// null when nothing has been saved yet - every value is then the emergency floor
	updatedAt: Date | null
	updatedBy: UpdatedBy | null
	// Fields the DB had in a broken shape (or didn't have) and that use the floor instead
	fallbackFields: string[]
}

export type ModelPriceEntry = {
	model: string
	price: ModelPrice
	updatedAt: Date | null
	updatedBy: UpdatedBy | null
}

// Today's spend spread over fixed USD buckets - see $lib/usagebudget/server/usage-stats
export type UsageBucket = {
	fromUsd: number
	// null = open-ended top bucket
	toUsd: number | null
	count: number
	totalUsd: number
}

export type UsageDistribution = {
	// Users (or bots) with any spend counted today
	active: number
	totalUsd: number
	buckets: UsageBucket[]
	// A settle that lands just after the day rolled over subtracts in the new window - noise, not spend
	negative: { count: number; totalUsd: number }
}

export type TodaysUsage = {
	// Start of the current day window (UTC-aligned, so 01:00/02:00 Norwegian time)
	since: Date
	users: UsageDistribution
	anonymousEmbedBots: UsageDistribution
}

export const BRUKERTYPE_LABELS: Record<Affiliation, string> = {
	employee: "Ansatt",
	edu_employee: "Skoleansatt",
	student: "Elev"
}

// Sanity ceilings - a value above them is a typo (an extra zero), not a decision
const usd = (max: number) => z.number().finite().positive().max(max)
const count = (max: number) => z.number().int().positive().max(max)

export const HourDayBudgetSchema = z.object({ perHourUsd: usd(100), perDayUsd: usd(500) }).strict()

export const ModelPriceSchema = z.object({ inputPerMillion: z.number().finite().nonnegative().max(1000), outputPerMillion: z.number().finite().nonnegative().max(1000) }).strict()

// One schema per top-level field, so the DB document can be validated field by field: a broken field
// falls back on its own, the valid rest is still used
export const UsageLimitsFieldSchemas = {
	budgets: z.object(Object.fromEntries(AFFILIATIONS.map((affiliation) => [affiliation, HourDayBudgetSchema])) as Record<Affiliation, typeof HourDayBudgetSchema>).strict(),
	anonymousEmbed: HourDayBudgetSchema,
	maxConcurrentCalls: count(50),
	webSearchCallPriceUsd: usd(1),
	embedRateLimits: z.object({ perIpPerMinute: count(10_000), perIpPerDay: count(100_000), perBotPerDay: count(1_000_000).nullable() }).strict()
}

export const UsageLimitsSchema = z.object(UsageLimitsFieldSchemas).strict()

export const USAGE_LIMITS_FIELDS = Object.keys(UsageLimitsFieldSchemas) as (keyof UsageLimits)[]
