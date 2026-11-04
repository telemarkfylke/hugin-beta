// One-time seed of the "feature-flags" collection with the role access Hugin had while it was
// hardcoded in $lib/authorization (before DB feature flags). Run once per environment, after that
// the DB is the only source of truth and is edited on /admin/features:
//
//   node --env-file=.env scripts/seed-feature-flags.mjs
//
// Only writes features that don't exist yet, or that the app auto-created with every role off and
// nobody has edited since (no updatedBy) - an admin's edit is never overwritten, so running it twice
// is harmless.
import { MongoClient } from "mongodb"

const INITIAL_ACCESS = {
	canvas: { employee: true, edu_employee: true, student: true },
	ragservice: { employee: true, edu_employee: false, student: false },
	mcpSharepoint: { employee: true, edu_employee: false, student: false },
	websiteSources: { employee: true, edu_employee: true, student: true },
	transcription: { employee: true, edu_employee: true, student: false },
	history: { employee: true, edu_employee: true, student: true }
}

const { MONGODB_CONNECTION_STRING, MONGODB_DB_NAME } = process.env
if (!MONGODB_CONNECTION_STRING) {
	console.error("[seed-feature-flags] MONGODB_CONNECTION_STRING is not set")
	process.exit(1)
}

const client = new MongoClient(MONGODB_CONNECTION_STRING)
try {
	const collection = client.db(MONGODB_DB_NAME).collection("feature-flags")
	for (const [feature, roles] of Object.entries(INITIAL_ACCESS)) {
		const existing = await collection.findOne({ _id: feature })
		if (existing?.updatedBy) {
			console.log(`[seed-feature-flags] ${feature}: already set by ${existing.updatedBy.name}, skipped`)
			continue
		}
		await collection.updateOne({ _id: feature }, { $set: { roles, updatedAt: new Date(), updatedBy: { id: "seed", name: "seed-feature-flags" } } }, { upsert: true })
		console.log(`[seed-feature-flags] ${feature}: ${JSON.stringify(roles)}`)
	}
} finally {
	await client.close()
}
