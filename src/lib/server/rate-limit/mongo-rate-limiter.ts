import { logger } from "@vestfoldfylke/loglady"
import type { Collection, Db, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import type { IRateLimiter, RateLimitResult } from "./interface"

type RateLimitDoc = {
	// `${key}:${windowStart}` - one document per (key, window), not per key, so a new window is a
	// fresh upsert rather than something that needs resetting. The previous window's document is
	// simply never queried again, and expires on its own (see the TTL index below).
	_id: string
	count: number
	expiresAt: Date
}

export class MongoRateLimiter implements IRateLimiter {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly collectionName = "rate-limits"
	private ttlIndexEnsured = false

	constructor(mongoClient: MongoClient) {
		this.mongoClient = mongoClient
	}

	private async getDb(): Promise<Db> {
		if (this.db) {
			return this.db
		}
		try {
			await this.mongoClient.connect()
			this.db = this.mongoClient.db(env.MONGODB_DB_NAME)
			return this.db
		} catch (error) {
			logger.errorException(error, "Error when connecting to MongoDB")
			throw error
		}
	}

	private async getCollection(): Promise<Collection<RateLimitDoc>> {
		const db = await this.getDb()
		const collection = db.collection<RateLimitDoc>(this.collectionName)
		if (!this.ttlIndexEnsured) {
			// expireAfterSeconds: 0 = expire exactly at expiresAt. Mongo's TTL background task only
			// sweeps roughly once a minute, so a document can briefly outlive its window - harmless
			// here, since the next window uses a different _id and never reads the stale one anyway.
			// Failure to create the index (e.g. no permission) is logged but not fatal - rate
			// limiting still works correctly, the collection just accumulates old window documents
			// until someone fixes the index (a documented ops follow-up, not a correctness issue).
			await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => {
				logger.errorException(error, "Failed to ensure rate-limit TTL index - rate limiting still works, but old window documents won't self-clean")
			})
			this.ttlIndexEnsured = true
		}
		return collection
	}

	async checkAndIncrement(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
		const collection = await this.getCollection()
		const now = Date.now()
		const windowStart = Math.floor(now / windowMs) * windowMs
		const windowEnd = windowStart + windowMs

		const result = await collection.findOneAndUpdate(
			{ _id: `${key}:${windowStart}` },
			{ $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowEnd) } },
			{ upsert: true, returnDocument: "after" }
		)

		// findOneAndUpdate with upsert always returns the (post-update) document in the MongoDB
		// Node driver - the `?? 1` is just defensive, not an expected path.
		const count = result?.count ?? 1
		return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfterMs: windowEnd - now }
	}
}
