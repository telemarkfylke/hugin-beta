import { logger } from "@vestfoldfylke/loglady"
import type { Collection, Db, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { type CategoryCount, type CategoryDateCount, FALLBACK_CATEGORY, type QuestionCategoryStat, type UncategorizedSample } from "$lib/statsstore/types"
import type { IStatsStore } from "./interface"

export class MongoStatsStore implements IStatsStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly collectionName: string

	constructor(mongoClient: MongoClient) {
		this.mongoClient = mongoClient
		this.collectionName = "question-category-stats"
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

	async recordQuestionCategory(agentId: string, category: string, date: Date, suggestedTopic?: string): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<QuestionCategoryStat> = db.collection(this.collectionName)
		await collection.insertOne(suggestedTopic ? { agentId, category, date, suggestedTopic } : { agentId, category, date })
	}

	async getCategoryStats(agentId: string, from: Date, to: Date): Promise<CategoryCount[]> {
		const db = await this.getDb()
		const collection: Collection<QuestionCategoryStat> = db.collection(this.collectionName)
		const results = await collection
			.aggregate<{ _id: string; count: number }>([{ $match: { agentId, date: { $gte: from, $lte: to } } }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
			.toArray()
		return results.map((r) => ({ category: r._id, count: r.count }))
	}

	async getCategoryStatsOverTime(agentId: string, category: string, from: Date, to: Date): Promise<CategoryDateCount[]> {
		const db = await this.getDb()
		const collection: Collection<QuestionCategoryStat> = db.collection(this.collectionName)
		const results = await collection
			.aggregate<{ _id: string; count: number }>([
				{ $match: { agentId, category, date: { $gte: from, $lte: to } } },
				{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, count: { $sum: 1 } } },
				{ $sort: { _id: 1 } }
			])
			.toArray()
		return results.map((r) => ({ date: r._id, count: r.count }))
	}

	async getUncategorizedSamples(agentId: string, from: Date, to: Date): Promise<UncategorizedSample[]> {
		const db = await this.getDb()
		const collection: Collection<QuestionCategoryStat> = db.collection(this.collectionName)
		const results = await collection
			.find({ agentId, category: FALLBACK_CATEGORY, date: { $gte: from, $lte: to }, suggestedTopic: { $exists: true } })
			.sort({ date: -1 })
			.toArray()
		// The $exists filter above guarantees suggestedTopic is present on every matched doc.
		return results.filter((r) => r.suggestedTopic).map((r) => ({ date: r.date, suggestedTopic: r.suggestedTopic as string }))
	}
}
