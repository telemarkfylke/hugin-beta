import { logger } from "@vestfoldfylke/loglady"
import type { Collection, Db, MongoClient } from "mongodb"
import { env } from "$env/dynamic/private"
import { FEATURE_ROLES, type FeatureFlag, type FeatureKey, type FeatureRoleAccess, isFeatureKey } from "$lib/featureflags/types"
import type { IFeatureFlagStore } from "./interface"

// One document per feature, the roles as an object of booleans - readable as-is in Mongo:
// { _id: "canvas", roles: { employee: true, edu_employee: true, student: false }, updatedAt, updatedBy }
type DbFeatureFlag = {
	_id: string
	roles: Partial<Record<string, boolean>>
	updatedAt?: Date
	updatedBy?: { id: string; name: string }
}

// Anything not literally true counts as off - a hand-edited document with a missing or misspelled
// role fails closed rather than open.
const toFeatureFlag = (doc: DbFeatureFlag & { _id: FeatureKey }): FeatureFlag => ({
	feature: doc._id,
	roles: Object.fromEntries(FEATURE_ROLES.map((role) => [role, doc.roles?.[role] === true])) as FeatureRoleAccess,
	updatedAt: doc.updatedAt ?? null,
	updatedBy: doc.updatedBy ?? null
})

export class MongoFeatureFlagStore implements IFeatureFlagStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly collectionName: string

	constructor(mongoClient: MongoClient) {
		this.mongoClient = mongoClient
		this.collectionName = "feature-flags"
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

	private async getCollection(): Promise<Collection<DbFeatureFlag>> {
		const db = await this.getDb()
		return db.collection<DbFeatureFlag>(this.collectionName)
	}

	async getFeatureFlags(): Promise<FeatureFlag[]> {
		const collection = await this.getCollection()
		const docs = await collection.find().toArray()
		return docs.filter((doc): doc is DbFeatureFlag & { _id: FeatureKey } => isFeatureKey(doc._id)).map(toFeatureFlag)
	}

	async insertMissingFeatures(features: FeatureKey[]): Promise<void> {
		if (features.length === 0) return
		const collection = await this.getCollection()
		// $setOnInsert: a concurrent insert from another instance, or an admin's edit, is never overwritten
		await collection.bulkWrite(
			features.map((feature) => ({
				updateOne: {
					filter: { _id: feature },
					update: { $setOnInsert: { roles: Object.fromEntries(FEATURE_ROLES.map((role) => [role, false])) } },
					upsert: true
				}
			}))
		)
	}

	async setFeatureRoles(feature: FeatureKey, roles: FeatureRoleAccess, updatedBy: { id: string; name: string }): Promise<FeatureFlag> {
		const collection = await this.getCollection()
		const updatedAt = new Date()
		await collection.updateOne({ _id: feature }, { $set: { roles, updatedAt, updatedBy } }, { upsert: true })
		return { feature, roles, updatedAt, updatedBy }
	}
}
