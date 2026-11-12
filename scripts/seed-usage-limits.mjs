// One-time seed of the "usage-limits" and "model-prices" collections with the values Hugin had while
// they were hardcoded (DEFAULT_USAGE_BUDGETS, MAX_CONCURRENT_CALLS, WEB_SEARCH_CALL_PRICE_USD, the
// EMBED_RATE_LIMIT_* defaults and the prices in models.config.ts). Run once per environment, after that
// the DB is the source of truth and is edited on /admin/ratelimits:
//
//   node --env-file=.env scripts/seed-usage-limits.mjs
//
// Without it the app still runs, on a strict emergency floor (student budget for everyone) and with
// every model priced as an unknown, expensive one. Only writes what doesn't exist yet, or what an
// earlier run of this script wrote - an admin's edit is never overwritten, so running it twice is harmless.
import { MongoClient } from "mongodb"

const INITIAL_LIMITS = {
	budgets: {
		employee: { perHourUsd: 1, perDayUsd: 4 },
		edu_employee: { perHourUsd: 1, perDayUsd: 4 },
		student: { perHourUsd: 0.3, perDayUsd: 1 }
	},
	anonymousEmbed: { perHourUsd: 1, perDayUsd: 5 },
	maxConcurrentCalls: 3,
	webSearchCallPriceUsd: 0.03,
	maxFileContentCharacters: 150000,
	embedRateLimits: { perIpPerMinute: 20, perIpPerDay: 200, perBotPerDay: null }
}

// Self-hosted models: no vendor price list, so a nominal price instead of the expensive unknown-model one
const SELF_HOSTED = { inputPerMillion: 0.01, outputPerMillion: 0.01 }

const INITIAL_PRICES = {
	"gpt-5.6-terra": { inputPerMillion: 2, outputPerMillion: 12 },
	"gpt-6-sol": { inputPerMillion: 2, outputPerMillion: 10 },
	"gpt-6-luna": { inputPerMillion: 0.1, outputPerMillion: 0.5 },
	"gpt-5.6-luna": { inputPerMillion: 0.2, outputPerMillion: 1.2 },
	"mistral-large": { inputPerMillion: 0.5, outputPerMillion: 1.5 },
	"ollama-llama3": SELF_HOSTED,
	"ollama-mistral": SELF_HOSTED,
	"ollama-gemma": SELF_HOSTED,
	"ollama-deepseek-r1": SELF_HOSTED,
	normistral: SELF_HOSTED
}

const SEED_USER = { id: "seed", name: "seed-usage-limits" }

const { MONGODB_CONNECTION_STRING, MONGODB_DB_NAME } = process.env
if (!MONGODB_CONNECTION_STRING) {
	console.error("[seed-usage-limits] MONGODB_CONNECTION_STRING is not set")
	process.exit(1)
}

const notEditedByAdmin = (doc) => !doc || doc.updatedBy?.id === SEED_USER.id

const client = new MongoClient(MONGODB_CONNECTION_STRING)
try {
	const db = client.db(MONGODB_DB_NAME)

	const limits = db.collection("usage-limits")
	const existing = await limits.findOne({ _id: "settings" })
	if (notEditedByAdmin(existing)) {
		await limits.updateOne({ _id: "settings" }, { $set: { ...INITIAL_LIMITS, updatedAt: new Date(), updatedBy: SEED_USER } }, { upsert: true })
		console.log(`[seed-usage-limits] usage limits: ${JSON.stringify(INITIAL_LIMITS)}`)
	} else {
		console.log(`[seed-usage-limits] usage limits: already set by ${existing.updatedBy?.name ?? "someone"}, skipped`)
	}

	const prices = db.collection("model-prices")
	for (const [model, price] of Object.entries(INITIAL_PRICES)) {
		const doc = await prices.findOne({ _id: model })
		if (!notEditedByAdmin(doc)) {
			console.log(`[seed-usage-limits] ${model}: already set by ${doc.updatedBy?.name ?? "someone"}, skipped`)
			continue
		}
		await prices.updateOne({ _id: model }, { $set: { ...price, updatedAt: new Date(), updatedBy: SEED_USER } }, { upsert: true })
		console.log(`[seed-usage-limits] ${model}: ${JSON.stringify(price)}`)
	}
} finally {
	await client.close()
}
