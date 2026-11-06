import { logger } from "@vestfoldfylke/loglady"
import type { Collection, Db, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { type ModelPrice, type UpdatedBy, USAGE_LIMITS_FIELDS, type UsageLimits } from "$lib/usagebudget/types"
import type { IUsageLimitsStore, RawModelPrice, RawUsageLimits } from "./interface"

// One document, readable as-is in Mongo:
// { _id: "settings", budgets: { employee: { perHourUsd, perDayUsd }, ... }, anonymousEmbed, maxConcurrentCalls, ... }
type DbUsageLimits = { _id: string; updatedAt?: Date; updatedBy?: UpdatedBy } & Partial<Record<keyof UsageLimits, unknown>>

// One document per catalogue model key: { _id: "gpt-6-sol", inputPerMillion: 2, outputPerMillion: 10, updatedAt, updatedBy }
type DbModelPrice = { _id: string; inputPerMillion?: unknown; outputPerMillion?: unknown; updatedAt?: Date; updatedBy?: UpdatedBy }

const SETTINGS_ID = "settings"

export class MongoUsageLimitsStore implements IUsageLimitsStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null

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

	private async limitsCollection(): Promise<Collection<DbUsageLimits>> {
		return (await this.getDb()).collection<DbUsageLimits>("usage-limits")
	}

	private async pricesCollection(): Promise<Collection<DbModelPrice>> {
		return (await this.getDb()).collection<DbModelPrice>("model-prices")
	}

	async getUsageLimits(): Promise<RawUsageLimits | null> {
		const doc = await (await this.limitsCollection()).findOne({ _id: SETTINGS_ID })
		if (!doc) {
			return null
		}
		return {
			values: Object.fromEntries(USAGE_LIMITS_FIELDS.map((field) => [field, doc[field]])),
			updatedAt: doc.updatedAt ?? null,
			updatedBy: doc.updatedBy ?? null
		}
	}

	async saveUsageLimits(limits: UsageLimits, updatedBy: UpdatedBy): Promise<void> {
		await (await this.limitsCollection()).updateOne({ _id: SETTINGS_ID }, { $set: { ...limits, updatedAt: new Date(), updatedBy } }, { upsert: true })
	}

	async getModelPrices(): Promise<RawModelPrice[]> {
		const docs = await (await this.pricesCollection()).find().toArray()
		return docs.map((doc) => ({
			model: doc._id,
			inputPerMillion: doc.inputPerMillion,
			outputPerMillion: doc.outputPerMillion,
			updatedAt: doc.updatedAt ?? null,
			updatedBy: doc.updatedBy ?? null
		}))
	}

	async setModelPrice(model: string, price: ModelPrice, updatedBy: UpdatedBy): Promise<void> {
		await (await this.pricesCollection()).updateOne({ _id: model }, { $set: { ...price, updatedAt: new Date(), updatedBy } }, { upsert: true })
	}

	async deleteModelPrice(model: string): Promise<void> {
		await (await this.pricesCollection()).deleteOne({ _id: model })
	}
}
