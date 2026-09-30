import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import { canViewMcpSource } from "$lib/authorization"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { McpSource, NewMcpSource } from "$lib/types/mcp-source"
import type { IMcpSourceStore } from "./interface"

type DbMcpSource = Omit<McpSource, "_id"> & { _id: ObjectId }

// MongoDB never backfills schema changes onto documents already written before the change - a
// SharePoint source created before `lists` existed on McpSourceConfig is missing that field in
// storage entirely, not merely an empty array. TypeScript's DbMcpSource type doesn't know this
// (it just claims `lists: string[]`), so reading such a doc as-is silently hands callers an
// `McpSource` whose `lists` is actually `undefined` at runtime - which crashed the source list UI
// (`source.lists.length` in McpSourceList.svelte) and the edit form (`[...source.lists]` in
// McpSourceForm.svelte) the moment this shipped, for every source created before it. Normalizing
// here, at the one place documents cross from storage into the rest of the app, means every other
// reader can keep trusting the McpSource type's `lists: string[]` without its own defensive check.
const normalizeMcpSource = (source: DbMcpSource): McpSource => ({ ...source, _id: source._id.toString(), lists: source.lists ?? [] })

export class MongoMcpSourceStore implements IMcpSourceStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly collectionName: string
	private indexesEnsured = false

	constructor(mongoClient: MongoClient) {
		if (!env.MONGODB_CONNECTION_STRING) {
			throw new Error("MONGODB_CONNECTION_STRING is not set (du har glemt den)")
		}
		if (!env.MONGODB_DB_NAME) {
			throw new Error("MONGODB_DB_NAME is not set (du har glemt den)")
		}
		this.mongoClient = mongoClient
		this.collectionName = "mcp-sources"
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

	// getMcpSources below used to fetch the entire collection with find({}) and rely solely on
	// canViewMcpSource, in application code, to narrow it down - fine while there are only a
	// handful of test sources, but it doesn't scale: every document crosses the wire and gets
	// deserialized for every list load, no matter how many of them the caller could never see
	// anyway. The query itself now does that narrowing (see getMcpSources), so these two indexes
	// back its `$or` - one per branch, since Mongo needs an index per top-level $or clause, not one
	// compound index across both. canViewMcpSource itself is unchanged and still applied - see the
	// comment on getMcpSources for why. Takes the already-resolved Db rather than calling getDb()
	// itself so every method below keeps its own collection<T>() typing (insert/replace need
	// NewMcpSource, everything else needs DbMcpSource) instead of all sharing one collection type.
	private async ensureIndexes(db: Db): Promise<void> {
		if (this.indexesEnsured) {
			return
		}
		const collection = db.collection(this.collectionName)
		await Promise.all([collection.createIndex({ type: 1 }), collection.createIndex({ "createdBy.id": 1 })]).catch((error) => {
			logger.errorException(error, "Failed to ensure mcp-sources indexes - getMcpSources still works correctly, just via a slower collection scan")
		})
		this.indexesEnsured = true
	}

	async getMcpSource(sourceId: string): Promise<McpSource | null> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const source = await db.collection<DbMcpSource>(this.collectionName).findOne({ _id: new ObjectId(sourceId) })
		if (!source) {
			return null
		}
		return normalizeMcpSource(source)
	}

	async getMcpSources(principal: AuthenticatedPrincipal): Promise<McpSource[]> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		// Admin sees everything, same as canViewMcpSource - narrowing the query for admin too would
		// just be a no-op $or that still matches every document, so it's skipped entirely rather
		// than spelled out. For everyone else, this mirrors canViewMcpSource's own two conditions
		// (published, or owned by this principal) so the DB does the real filtering instead of
		// application code doing it after fetching every document regardless of visibility.
		// canViewMcpSource is still applied below on the (now much smaller) result set - not because
		// the query above is untrusted, but so the authorization rule keeps living in exactly one
		// place instead of being reimplemented in two places that could silently drift apart later.
		const isAdmin = principal.roles.includes(APP_CONFIG.APP_ROLES.ADMIN)
		const query: Filter<DbMcpSource> = isAdmin ? {} : { $or: [{ type: "published" }, { "createdBy.id": principal.userId }] }
		const sources = (await collection.find(query).toArray()).map(normalizeMcpSource)
		return sources.filter((source) => canViewMcpSource(source, principal, APP_CONFIG.APP_ROLES))
	}

	async createMcpSource(source: NewMcpSource): Promise<McpSource> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const collection: Collection<NewMcpSource> = db.collection(this.collectionName)
		const result = await collection.insertOne(source)
		return { ...source, _id: result.insertedId.toString() }
	}

	async replaceMcpSource(sourceId: string, source: NewMcpSource): Promise<McpSource> {
		const db = await this.getDb()
		await this.ensureIndexes(db)
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		await collection.replaceOne({ _id: new ObjectId(sourceId) }, source)
		return { ...source, _id: sourceId }
	}

	async deleteMcpSource(sourceId: string): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbMcpSource> = db.collection(this.collectionName)
		await collection.deleteOne({ _id: new ObjectId(sourceId) })
	}
}
