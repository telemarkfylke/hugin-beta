import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import { canViewAllChatConfigs } from "$lib/authorization"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ConversationMessagePair, Conversation, NewConversation, NewConversationMessagePair } from "../../types"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import type { IConversationStore } from "./interface"


export type DbConversation = NewConversation & { _id: ObjectId }
export type DbConversationMessagePair = NewConversationMessagePair & { _id: ObjectId }

export class MongoConversationStore implements IConversationStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly conversationCollectionName: string
	private readonly messagesCollectionName: string

	constructor(mongoClient: MongoClient, mongoDb: Db | null) {
		this.mongoClient = mongoClient
		this.db = mongoDb		
		this.conversationCollectionName = "conversations"
		this.messagesCollectionName = "messages"
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

	async getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null> {
		const db = await this.getDb()
		const conversation = await db.collection<Conversation>(this.conversationCollectionName).findOne({ _id: new ObjectId(conversationId), "owner": principal.userId })
		if (!conversation) {
			return null
		}
		return { ...conversation, id: conversationId }
	}

	async getConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)

		if (canViewAllChatConfigs(principal, APP_CONFIG.APP_ROLES)) {
			return (await collection.find({}).toArray()).map((config) => ({ ...config, id: config._id.toString() }))
		}

		const query: Filter<DbConversation> = { "owner": principal.userId }
		

		const chatConfigs = await collection.find(query).toArray()
		return chatConfigs.map((config) => ({ ...config, id: config._id.toString() }))
	}

	async createConversation(conversation: NewConversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		conversation.owner = principal.userId
		const db = await this.getDb()
		const collection: Collection<NewConversation> = db.collection(this.conversationCollectionName)
		const result = await collection.insertOne(conversation)
		return { ...conversation, id: result.insertedId.toString() }
	}

	async replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		conversation.owner = principal.userId
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		await collection.replaceOne({ _id: new ObjectId(conversationId) }, conversation)
		return { ...conversation, id: conversationId, "owner": principal.userId }
	}

	async deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		await collection.deleteOne({ _id: new ObjectId(conversationId), "owner": principal.userId  })
	}

	async appendConversationMessage(conversationId: string, messagePair: NewConversationMessagePair, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> {
		messagePair.owner = principal.userId
		messagePair.conversationId = conversationId
		const db = await this.getDb()
		const collection: Collection<NewConversationMessagePair> = db.collection(this.messagesCollectionName)
		const result = await collection.insertOne(messagePair)
		return { ...messagePair, id: result.insertedId.toString() }
	}

	async getConversationMessages(conversationId: string, last: number | null, cursor: string | null, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		const query:Filter<DbConversationMessagePair> = cursor ? 
		{ "owner": principal.userId, conversationId:conversationId, _id: { $lt: new ObjectId(cursor) } }  :
		{ "owner": principal.userId, conversationId:conversationId }
		
		
		const run = collection.find(query).sort('_id', 'desc' )
		if(last) run.limit(last)
		
		const conversationMessages = (await run.toArray())
		return conversationMessages.map((message) => ({ ...message, id: message._id.toString() })).reverse()
	}

	async getUnsummarizedConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		const query: Filter<DbConversationMessagePair> = 
				{ "owner": principal.userId, "conversationId": conversationId, "includedInSummary":false }
		const conversationMessages = await collection.find(query).sort('createdAt', 'asc' ).toArray()
		return conversationMessages.map((message) => ({ ...message, id: message._id.toString() }))
	}

	async deleteConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		await collection.deleteMany({ conversationId: conversationId, "owner": principal.userId  })
	}

}
