import { logger } from "@vestfoldfylke/loglady"
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from "mongodb"
import { env } from "$env/dynamic/private"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "../../types"
import { decryptValue, encryptValue, isEncryptionConfigured } from "../message-encryption"
import type { IConversationStore } from "./interface"

// title/summary are written independently (title via updateConversationTitle, summary via a
// not-yet-implemented summarization job) and so can end up encrypted under different key
// versions after a rotation - each gets its own *KeyVersion field, unlike the message pair below
// where userInput/response are always written together and can safely share one version field.
export type DbConversation = NewConversation & {
	_id: ObjectId
	titleKeyVersion?: string
	summaryKeyVersion?: string
}

// userInput/response hold the plaintext object when the message predates encryption (or was
// written while encryption wasn't configured), or a base64 ciphertext string when encrypted.
// encryptionKeyVersion present <=> encrypted; absent <=> plaintext. See message-encryption.ts.
export type NewDbConversationMessagePair = Omit<NewConversationMessagePair, "userInput" | "response"> & {
	userInput: ChatInputItem | string
	response: ChatResponseObject | string
	encryptionKeyVersion?: string
}
export type DbConversationMessagePair = NewDbConversationMessagePair & { _id: ObjectId }

// A decrypt failure (missing/rotated-out key, corrupted ciphertext) must not take the whole
// "Samtaler" list or a whole conversation's history down with it - every decrypt call below is
// wrapped so one bad item falls back to this visible placeholder instead of throwing out of the
// surrounding .map(), which would otherwise abort every other (perfectly readable) item too.
const DECRYPTION_FAILURE_PLACEHOLDER = "<KRYPTERT INNHOLD>"

const buildDecryptionFailureInput = (): ChatInputItem => ({
	type: "message.input",
	role: "user",
	content: [{ type: "input_text", text: DECRYPTION_FAILURE_PLACEHOLDER }]
})

const buildDecryptionFailureResponse = (id: string): ChatResponseObject => ({
	id: `decryption-failed-${id}`,
	type: "chat_response",
	// status: "failed" keeps this synthetic response out of the vendor-bound context that
	// chatHistoryToInputItems builds (see its own comment on dropping "failed" responses) - so a
	// message that couldn't be decrypted is shown to the user but never replayed to the vendor.
	status: "failed",
	config: {
		// _id: "" is this codebase's existing "no real config" sentinel (see placeHolderConfig in
		// ChatState.svelte.ts) - ChatState.loadChat reads the last chat_response's config to detect
		// which agent a conversation last belonged to, and must skip this synthetic one rather than
		// treating "Kryptert innhold" as a real agent name/id to offer resuming the chat with.
		_id: "",
		name: "Kryptert innhold",
		description: "Denne meldingen kunne ikke dekrypteres",
		vendorId: "OPENAI",
		project: "DEFAULT",
		type: "private",
		accessGroups: [],
		created: { at: new Date().toISOString(), by: { id: "system" } },
		updated: { at: new Date().toISOString(), by: { id: "system" } }
	},
	createdAt: new Date().toISOString(),
	outputs: [{ id: `decryption-failed-${id}`, type: "message.output", role: "assistant", content: [{ type: "output_text", text: DECRYPTION_FAILURE_PLACEHOLDER }] }],
	usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
})

const toDbMessagePair = (messagePair: NewConversationMessagePair): NewDbConversationMessagePair => {
	if (!isEncryptionConfigured()) {
		return messagePair
	}
	const encryptedUserInput = encryptValue(messagePair.userInput)
	const encryptedResponse = encryptValue(messagePair.response)
	return {
		...messagePair,
		userInput: encryptedUserInput.data,
		response: encryptedResponse.data,
		// Both fields are always encrypted under the same (currently active) key version.
		encryptionKeyVersion: encryptedUserInput.encryptionKeyVersion
	}
}

const fromDbMessagePair = (doc: DbConversationMessagePair): ConversationMessagePair => {
	const { _id, encryptionKeyVersion, userInput, response, ...rest } = doc
	const id = _id.toString()
	if (encryptionKeyVersion === undefined) {
		return { ...rest, id, userInput: userInput as ChatInputItem, response: response as ChatResponseObject }
	}
	try {
		return {
			...rest,
			id,
			userInput: decryptValue<ChatInputItem>(userInput as string, encryptionKeyVersion),
			response: decryptValue<ChatResponseObject>(response as string, encryptionKeyVersion)
		}
	} catch (error) {
		logger.errorException(error, `Failed to decrypt conversation message ${id} (key version "${encryptionKeyVersion}") - showing a placeholder instead of failing the whole request`)
		return { ...rest, id, userInput: buildDecryptionFailureInput(), response: buildDecryptionFailureResponse(id) }
	}
}

/**
 * Encrypts an optional string field. Returns it untouched (and keyVersion undefined) when absent
 * or when encryption isn't configured. Generic over T so a call with a required `string` (e.g.
 * updateConversationTitle's `title` param) gets back a definitely-`string` value, not a widened
 * `string | undefined` - needed under `exactOptionalPropertyTypes` so callers never have to
 * explicitly assign `undefined` into an optional DbConversation field.
 */
const encryptOptionalField = <T extends string | undefined>(value: T): { value: T; keyVersion: string | undefined } => {
	if (value === undefined || !isEncryptionConfigured()) {
		return { value, keyVersion: undefined }
	}
	const encrypted = encryptValue(value)
	return { value: encrypted.data as T, keyVersion: encrypted.encryptionKeyVersion }
}

/**
 * keyVersion undefined <=> value is already plaintext (or absent) - nothing to decrypt.
 * A decrypt failure falls back to the placeholder (see comment above DECRYPTION_FAILURE_PLACEHOLDER)
 * instead of throwing, so one conversation with an unreadable title can't break the whole list.
 */
const decryptOptionalField = (value: string | undefined, keyVersion: string | undefined, context: string): string | undefined => {
	if (value === undefined || keyVersion === undefined) {
		return value
	}
	try {
		return decryptValue<string>(value, keyVersion)
	} catch (error) {
		logger.errorException(error, `Failed to decrypt ${context} (key version "${keyVersion}") - showing a placeholder instead of failing the whole request`)
		return DECRYPTION_FAILURE_PLACEHOLDER
	}
}

const toDbConversation = (conversation: NewConversation): Omit<DbConversation, "_id"> => {
	const title = encryptOptionalField(conversation.title)
	const summary = encryptOptionalField(conversation.summary)
	return {
		...conversation,
		// Spread conditionally rather than assigning `title: title.value` directly - under
		// exactOptionalPropertyTypes an optional field must be omitted, not set to `undefined`.
		...(title.value !== undefined && { title: title.value, ...(title.keyVersion !== undefined && { titleKeyVersion: title.keyVersion }) }),
		...(summary.value !== undefined && { summary: summary.value, ...(summary.keyVersion !== undefined && { summaryKeyVersion: summary.keyVersion }) })
	}
}

const fromDbConversation = (doc: DbConversation): Conversation => {
	const { _id, titleKeyVersion, summaryKeyVersion, ...rest } = doc
	const title = decryptOptionalField(rest.title, titleKeyVersion, `conversation ${_id} title`)
	const summary = decryptOptionalField(rest.summary, summaryKeyVersion, `conversation ${_id} summary`)
	return {
		...rest,
		id: _id.toString(),
		...(title !== undefined && { title }),
		...(summary !== undefined && { summary })
	}
}

export class MongoConversationStore implements IConversationStore {
	private readonly mongoClient: MongoClient
	private db: Db | null = null
	private readonly conversationCollectionName: string
	private readonly messagesCollectionName: string

	constructor(mongoClient: MongoClient, mongoDb: Db | null) {
		this.mongoClient = mongoClient
		this.db = mongoDb
		this.conversationCollectionName = "conversations"
		this.messagesCollectionName = "conversation-messages"
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
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		const conversation = await collection.findOne({ _id: new ObjectId(conversationId), owner: principal.userId })
		if (!conversation) {
			return null
		}
		return fromDbConversation(conversation)
	}

	async getConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)

		// Conversations are private - unlike chat configs, there is no "view all" bypass here.
		const query: Filter<DbConversation> = { owner: principal.userId }
		const conversations = await collection.find(query).sort({ updatedAt: -1 }).toArray()
		return conversations.map(fromDbConversation)
	}

	async createConversation(conversation: NewConversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		conversation.owner = principal.userId
		const db = await this.getDb()
		const collection: Collection<Omit<DbConversation, "_id">> = db.collection(this.conversationCollectionName)
		const result = await collection.insertOne(toDbConversation(conversation))
		// Returned to the caller in plaintext - built from the original (never-encrypted) param, not the inserted doc.
		return { ...conversation, id: result.insertedId.toString() }
	}

	async replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		conversation.owner = principal.userId
		const db = await this.getDb()
		const collection: Collection<Omit<DbConversation, "_id">> = db.collection(this.conversationCollectionName)
		await collection.replaceOne({ _id: new ObjectId(conversationId) }, toDbConversation(conversation))
		return { ...conversation, id: conversationId, owner: principal.userId }
	}

	async deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		await collection.deleteOne({ _id: new ObjectId(conversationId), owner: principal.userId })
	}

	async updateConversationTitle(conversationId: string, title: string, principal: AuthenticatedPrincipal): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		const encryptedTitle = encryptOptionalField(title)
		const filter: Filter<DbConversation> = { _id: new ObjectId(conversationId), owner: principal.userId }
		if (encryptedTitle.keyVersion === undefined) {
			// Encryption isn't configured - $unset titleKeyVersion so a stale version from before
			// encryption was turned off doesn't make a later read try to decrypt this plaintext title.
			await collection.updateOne(filter, { $set: { title: encryptedTitle.value }, $unset: { titleKeyVersion: "" }, $currentDate: { updatedAt: true } })
		} else {
			await collection.updateOne(filter, { $set: { title: encryptedTitle.value, titleKeyVersion: encryptedTitle.keyVersion }, $currentDate: { updatedAt: true } })
		}
	}

	async appendConversationMessage(conversationId: string, messagePair: NewConversationMessagePair, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> {
		messagePair.owner = principal.userId
		messagePair.conversationId = conversationId
		const db = await this.getDb()
		const collection: Collection<NewDbConversationMessagePair> = db.collection(this.messagesCollectionName)
		const result = await collection.insertOne(toDbMessagePair(messagePair))

		// Keep the conversation's own updatedAt current too, since the "Samtaler" list sorts by it.
		const conversationCollection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		await conversationCollection.updateOne({ _id: new ObjectId(conversationId), owner: principal.userId }, { $currentDate: { updatedAt: true } })

		// Returned to the caller in plaintext - built from the original (never-encrypted) param, not the inserted doc.
		return { ...messagePair, id: result.insertedId.toString() }
	}

	async getConversationMessages(conversationId: string, last: number | null, cursor: string | null, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		const query: Filter<DbConversationMessagePair> = cursor
			? { owner: principal.userId, conversationId: conversationId, _id: { $lt: new ObjectId(cursor) } }
			: { owner: principal.userId, conversationId: conversationId }

		const run = collection.find(query).sort("_id", "desc")
		if (last) run.limit(last)

		const conversationMessages = await run.toArray()
		return conversationMessages.map(fromDbMessagePair).reverse()
	}

	async getUnsummarizedConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair[]> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		const query: Filter<DbConversationMessagePair> = { owner: principal.userId, conversationId: conversationId, includedInSummary: false }
		const conversationMessages = await collection.find(query).sort("_id", "asc").toArray()
		return conversationMessages.map(fromDbMessagePair)
	}

	async deleteConversationMessages(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		const db = await this.getDb()
		const collection: Collection<DbConversationMessagePair> = db.collection(this.messagesCollectionName)
		await collection.deleteMany({ conversationId: conversationId, owner: principal.userId })
	}
}
