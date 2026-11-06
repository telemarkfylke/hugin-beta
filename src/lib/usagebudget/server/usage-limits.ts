import { logger } from "@vestfoldfylke/loglady"
import { getUsageLimitsStore } from "$lib/server/db/get-db"
import { AFFILIATIONS } from "$lib/types/authentication"
import { type ModelPrice, type ModelPriceEntry, ModelPriceSchema, USAGE_LIMITS_FIELDS, type UsageLimits, UsageLimitsFieldSchemas, type UsageLimitsSettings } from "$lib/usagebudget/types"
import type { RawModelPrice, RawUsageLimits } from "./adapters/interface"

// The emergency floor - NOT the intended values (those are in the DB, edited on /admin/ratelimits).
// Used for any field the DB doesn't have, or has in a broken shape, e.g. a fresh database or a bad
// hand edit. Deliberately strict (student level for everyone), so a missing value means "everyone gets
// little", never "no limit". A model without a DB price gets UNKNOWN_MODEL_PRICE (see cost.ts).
const STUDENT_FLOOR = { perHourUsd: 0.3, perDayUsd: 1 }
export const FALLBACK_USAGE_LIMITS: UsageLimits = {
	budgets: Object.fromEntries(AFFILIATIONS.map((affiliation) => [affiliation, { ...STUDENT_FLOOR }])) as UsageLimits["budgets"],
	anonymousEmbed: { ...STUDENT_FLOOR },
	maxConcurrentCalls: 2,
	webSearchCallPriceUsd: 0.03,
	embedRateLimits: { perIpPerMinute: 20, perIpPerDay: 200, perBotPerDay: null }
}

// Field by field: a broken field falls back to the floor on its own, the valid rest is still used
export const resolveUsageLimits = (raw: RawUsageLimits | null): UsageLimitsSettings => {
	const limits = structuredClone(FALLBACK_USAGE_LIMITS) as Record<keyof UsageLimits, unknown>
	const fallbackFields: string[] = []
	for (const field of USAGE_LIMITS_FIELDS) {
		const parsed = UsageLimitsFieldSchemas[field].safeParse(raw?.values[field])
		if (parsed.success) {
			limits[field] = parsed.data
		} else {
			fallbackFields.push(field)
		}
	}
	return { limits: limits as UsageLimits, updatedAt: raw?.updatedAt ?? null, updatedBy: raw?.updatedBy ?? null, fallbackFields }
}

// A broken price document is left out, so that model is priced as UNKNOWN_MODEL_PRICE - never as free
export const resolveModelPrices = (raw: RawModelPrice[]): { entries: ModelPriceEntry[]; invalid: string[] } => {
	const entries: ModelPriceEntry[] = []
	const invalid: string[] = []
	for (const doc of raw) {
		const parsed = ModelPriceSchema.safeParse({ inputPerMillion: doc.inputPerMillion, outputPerMillion: doc.outputPerMillion })
		if (parsed.success) {
			entries.push({ model: doc.model, price: parsed.data, updatedAt: doc.updatedAt, updatedBy: doc.updatedBy })
		} else {
			invalid.push(doc.model)
		}
	}
	return { entries, invalid }
}

export type UsageLimitsSnapshot = {
	settings: UsageLimitsSettings
	prices: ModelPriceEntry[]
	invalidPrices: string[]
	priceByModel: Record<string, ModelPrice>
}

// Read on every chat/canvas call, so cached in memory. A save on /admin/ratelimits clears the cache on
// the instance that served it right away; other instances pick it up within CACHE_TTL_MS.
const CACHE_TTL_MS = 60_000

let cache: { snapshot: UsageLimitsSnapshot; fetchedAt: number } | null = null
let pendingLoad: Promise<UsageLimitsSnapshot> | null = null

const toSnapshot = (settings: UsageLimitsSettings, prices: { entries: ModelPriceEntry[]; invalid: string[] }): UsageLimitsSnapshot => ({
	settings,
	prices: prices.entries,
	invalidPrices: prices.invalid,
	priceByModel: Object.fromEntries(prices.entries.map((entry) => [entry.model, entry.price]))
})

const loadSnapshot = async (): Promise<UsageLimitsSnapshot> => {
	const store = getUsageLimitsStore()
	const [rawLimits, rawPrices] = await Promise.all([store.getUsageLimits(), store.getModelPrices()])
	const settings = resolveUsageLimits(rawLimits)
	const prices = resolveModelPrices(rawPrices)
	if (settings.fallbackFields.length > 0) {
		logger.warn("Usage limits missing or invalid in DB, using the emergency floor for: {fields}", settings.fallbackFields.join(", "))
	}
	if (prices.invalid.length > 0) {
		logger.warn("Invalid model prices in DB, priced as unknown models instead: {models}", prices.invalid.join(", "))
	}
	return toSnapshot(settings, prices)
}

export const getUsageLimitsSnapshot = async (): Promise<UsageLimitsSnapshot> => {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
		return cache.snapshot
	}
	pendingLoad ??= loadSnapshot()
		.then((snapshot) => {
			cache = { snapshot, fetchedAt: Date.now() }
			return snapshot
		})
		.catch((error) => {
			logger.errorException(error, "Failed to load usage limits")
			// Keep serving the last known values (and retry after another TTL) rather than hammering a DB
			// that's down. With nothing loaded yet, the floor - and every model priced as unknown.
			if (cache) {
				cache = { snapshot: cache.snapshot, fetchedAt: Date.now() }
				return cache.snapshot
			}
			return toSnapshot(resolveUsageLimits(null), { entries: [], invalid: [] })
		})
		.finally(() => {
			pendingLoad = null
		})
	return pendingLoad
}

export const getUsageLimits = async (): Promise<UsageLimits> => (await getUsageLimitsSnapshot()).settings.limits

export const invalidateUsageLimits = (): void => {
	cache = null
}
