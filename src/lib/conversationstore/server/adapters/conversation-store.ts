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
// *AadVersion: see buildAad below - same per-field independence as *KeyVersion.
export type DbConversation = NewConversation & {
	_id: ObjectId
	titleKeyVersion?: string
	titleAadVersion?: number
	summaryKeyVersion?: string
	summaryAadVersion?: number
}

// userInput/response hold the plaintext object when the message predates encryption (or was
// written while encryption wasn't configured), or a base64 ciphertext string when encrypted.
// encryptionKeyVersion present <=> encrypted; absent <=> plaintext. See message-encryption.ts.
// aadVersion present <=> encrypted with owner/conversation binding (see buildAad); absent on
// ciphertext written before that existed.
export type NewDbConversationMessagePair = Omit<NewConversationMessagePair, "userInput" | "response"> & {
	userInput: ChatInputItem | string
	response: ChatResponseObject | string
	encryptionKeyVersion?: string
	aadVersion?: number
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

// AAD (GCM additional authenticated data, see encryptValue) binds every ciphertext to the owner +
// conversation + field it was written for. The binding is built from the document's own stored
// owner/conversationId at read time - so if someone with DB write access (but no key) rewrites
// `owner` to themselves, or copies a ciphertext into another conversation, decryption fails
// instead of the app happily decrypting it for the new "owner". Including the field name also
// stops swapping e.g. title <-> summary or userInput <-> response.
// Versioned so the format can change later: the version is stored next to the ciphertext, and
// stripping it doesn't help an attacker - ciphertext written with AAD won't decrypt without it.
// Data written before AAD existed has no version field and is still decrypted without AAD; it only
// gets the binding once re-encrypted (see memory "hugin-conversation-maintenance-jobs").
const AAD_VERSION = 1

const buildAad = (aadVersion: number, owner: string, conversationId: string, field: string): string => {
	if (aadVersion !== 1) {
		throw new Error(`Unknown AAD version ${aadVersion}`)
	}
	return `hugin-conversation:v1:${owner}:${conversationId}:${field}`
}

const toDbMessagePair = (messagePair: NewConversationMessagePair): NewDbConversationMessagePair => {
	if (!isEncryptionConfigured()) {
		return messagePair
	}
	const { owner, conversationId } = messagePair
	const encryptedUserInput = encryptValue(messagePair.userInput, buildAad(AAD_VERSION, owner, conversationId, "userInput"))
	const encryptedResponse = encryptValue(messagePair.response, buildAad(AAD_VERSION, owner, conversationId, "response"))
	return {
		...messagePair,
		userInput: encryptedUserInput.data,
		response: encryptedResponse.data,
		// Both fields are always encrypted under the same (currently active) key version.
		encryptionKeyVersion: encryptedUserInput.encryptionKeyVersion,
		aadVersion: AAD_VERSION
	}
}

const fromDbMessagePair = (doc: DbConversationMessagePair): ConversationMessagePair => {
	const { _id, encryptionKeyVersion, aadVersion, userInput, response, ...rest } = doc
	const id = _id.toString()
	if (encryptionKeyVersion === undefined) {
		return { ...rest, id, userInput: userInput as ChatInputItem, response: response as ChatResponseObject }
	}
	try {
		const aadFor = (field: string) => (aadVersion === undefined ? undefined : buildAad(aadVersion, rest.owner, rest.conversationId, field))
		return {
			...rest,
			id,
			userInput: decryptValue<ChatInputItem>(userInput as string, encryptionKeyVersion, aadFor("userInput")),
			response: decryptValue<ChatResponseObject>(response as string, encryptionKeyVersion, aadFor("response"))
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
const encryptOptionalField = <T extends string | undefined>(value: T, aad: string): { value: T; keyVersion: string | undefined } => {
	if (value === undefined || !isEncryptionConfigured()) {
		return { value, keyVersion: undefined }
	}
	const encrypted = encryptValue(value, aad)
	return { value: encrypted.data as T, keyVersion: encrypted.encryptionKeyVersion }
}

/**
 * keyVersion undefined <=> value is already plaintext (or absent) - nothing to decrypt.
 * getAad returning undefined <=> legacy ciphertext written before AAD binding (see buildAad) - a
 * thunk so an unknown AAD version throws inside the try below, like any other decrypt failure.
 * A decrypt failure falls back to the placeholder (see comment above DECRYPTION_FAILURE_PLACEHOLDER)
 * instead of throwing, so one conversation with an unreadable title can't break the whole list.
 */
const decryptOptionalField = (value: string | undefined, keyVersion: string | undefined, getAad: () => string | undefined, context: string): string | undefined => {
	if (value === undefined || keyVersion === undefined) {
		return value
	}
	try {
		return decryptValue<string>(value, keyVersion, getAad())
	} catch (error) {
		logger.errorException(error, `Failed to decrypt ${context} (key version "${keyVersion}") - showing a placeholder instead of failing the whole request`)
		return DECRYPTION_FAILURE_PLACEHOLDER
	}
}

// conversationId is a separate param since a NewConversation has no id yet - createConversation
// generates the ObjectId up front so title/summary can be bound to it before the insert.
const toDbConversation = (conversation: NewConversation, conversationId: string): Omit<DbConversation, "_id"> => {
	const title = encryptOptionalField(conversation.title, buildAad(AAD_VERSION, conversation.owner, conversationId, "title"))
	const summary = encryptOptionalField(conversation.summary, buildAad(AAD_VERSION, conversation.owner, conversationId, "summary"))
	return {
		...conversation,
		// Spread conditionally rather than assigning `title: title.value` directly - under
		// exactOptionalPropertyTypes an optional field must be omitted, not set to `undefined`.
		...(title.value !== undefined && { title: title.value, ...(title.keyVersion !== undefined && { titleKeyVersion: title.keyVersion, titleAadVersion: AAD_VERSION }) }),
		...(summary.value !== undefined && { summary: summary.value, ...(summary.keyVersion !== undefined && { summaryKeyVersion: summary.keyVersion, summaryAadVersion: AAD_VERSION }) })
	}
}

const fromDbConversation = (doc: DbConversation): Conversation => {
	const { _id, titleKeyVersion, titleAadVersion, summaryKeyVersion, summaryAadVersion, ...rest } = doc
	const conversationId = _id.toString()
	const aadFor = (aadVersion: number | undefined, field: string) => () => (aadVersion === undefined ? undefined : buildAad(aadVersion, rest.owner, conversationId, field))
	const title = decryptOptionalField(rest.title, titleKeyVersion, aadFor(titleAadVersion, "title"), `conversation ${_id} title`)
	const summary = decryptOptionalField(rest.summary, summaryKeyVersion, aadFor(summaryAadVersion, "summary"), `conversation ${_id} summary`)
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
		const collection: Collection<DbConversation> = db.collection(this.conversationCollectionName)
		// _id generated here rather than by Mongo so title/summary can be AAD-bound to it (see buildAad).
		const _id = new ObjectId()
		await collection.insertOne({ ...toDbConversation(conversation, _id.toString()), _id })
		// Returned to the caller in plaintext - built from the original (never-encrypted) param, not the inserted doc.
		return { ...conversation, id: _id.toString() }
	}

	async replaceConversation(conversationId: string, conversation: Conversation, principal: AuthenticatedPrincipal): Promise<Conversation> {
		conversation.owner = principal.userId
		const db = await this.getDb()
		const collection: Collection<Omit<DbConversation, "_id">> = db.collection(this.conversationCollectionName)
		await collection.replaceOne({ _id: new ObjectId(conversationId) }, toDbConversation(conversation, conversationId))
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
		// Bound to principal.userId - safe because the filter below only matches a doc it owns.
		const encryptedTitle = encryptOptionalField(title, buildAad(AAD_VERSION, principal.userId, conversationId, "title"))
		const filter: Filter<DbConversation> = { _id: new ObjectId(conversationId), owner: principal.userId }
		if (encryptedTitle.keyVersion === undefined) {
			// Encryption isn't configured - $unset titleKeyVersion/titleAadVersion so stale versions from
			// before encryption was turned off don't make a later read try to decrypt this plaintext title.
			await collection.updateOne(filter, { $set: { title: encryptedTitle.value }, $unset: { titleKeyVersion: "", titleAadVersion: "" }, $currentDate: { updatedAt: true } })
		} else {
			await collection.updateOne(filter, { $set: { title: encryptedTitle.value, titleKeyVersion: encryptedTitle.keyVersion, titleAadVersion: AAD_VERSION }, $currentDate: { updatedAt: true } })
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
