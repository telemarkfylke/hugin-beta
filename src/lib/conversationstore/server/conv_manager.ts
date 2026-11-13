import { logger } from "@vestfoldfylke/loglady"
import { chatHistoryToInputItems } from "$lib/chat-history"
import type { IAttachmentBlobStore } from "$lib/conversationattachments/server/adapters/interface"
import { conversationAttachmentPrefix } from "$lib/conversationattachments/server/attachment-keys"
import { loadStoredAttachments, readStoredAttachment } from "$lib/conversationattachments/server/load-attachments"
import { moveAttachmentsToStorage } from "$lib/conversationattachments/server/store-attachments"
import type { ConversationAttachmentEntry } from "$lib/conversationattachments/types"
import { buildUtilityConfig, createUtilityChatResponse } from "$lib/server/utility-llm"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatHistory, ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { OutputText } from "$lib/types/chat-item-content"
import type { Conversation, ConversationMessagePair, NewConversation, NewConversationMessagePair } from "../types"
import type { IConversationStore } from "./adapters/interface"

const TITLE_INSTRUCTION = "Lag en kort, presis tittel (maks 6 ord) som oppsummerer denne samtalen. Svar kun med selve tittelen - ingen anførselstegn, ingen avsluttende punktum, ingen annen tekst."

const extractResponseText = (response: ChatResponseObject): string => {
	return response.outputs
		.flatMap((output) => (output.type === "message.output" ? output.content : []))
		.filter((content): content is OutputText => content.type === "output_text")
		.map((content) => content.text)
		.join("")
}

export class ConversationManager {
	private converationStore: IConversationStore
	// null = attachments stay inline in the message (no S3 configured) - see getAttachmentBlobStore
	private attachmentBlobStore: IAttachmentBlobStore | null

	constructor(conversationStore: IConversationStore, attachmentBlobStore: IAttachmentBlobStore | null = null) {
		this.converationStore = conversationStore
		this.attachmentBlobStore = attachmentBlobStore
	}

	public async generateTitle(conversationId: string, principal: AuthenticatedPrincipal): Promise<string | null> {
		const conversation = await this.converationStore.getConversation(conversationId, principal)
		if (!conversation || conversation.title) {
			return conversation?.title ?? null // Doesn't exist, or already has a title - nothing to do.
		}

		const history = await this.getChatHistoryFromDb(conversationId, principal)
		const lastResponse = [...history].reverse().find((item): item is ChatResponseObject => item.type === "chat_response")
		if (!lastResponse) {
			return null // No response yet to base a title on.
		}

		// Runs on the dedicated small utility model (see $lib/server/utility-llm) rather than
		// whatever vendor/model this conversation itself uses - titling is a small, mechanical
		// summarization task that doesn't need a large/expensive model.
		const titleRequest: ChatRequest = {
			config: buildUtilityConfig(TITLE_INSTRUCTION),
			inputs: chatHistoryToInputItems(history),
			stream: false
		}

		const response = await createUtilityChatResponse(titleRequest)
		if (response.status !== "completed") {
			// Truncated/filtered/empty response from the utility model - don't save whatever
			// (if anything) came back as the title. Left titleless; a later retry can pick it up.
			return null
		}

		const title = extractResponseText(response).trim()
		if (!title) {
			return null
		}
		await this.converationStore.updateConversationTitle(conversationId, title, principal)
		return title
	}

	// User-driven rename - unlike generateTitle, this always overwrites (no "already has a title"
	// no-op), since the whole point is letting someone replace a title they don't like.
	public async renameConversation(conversationId: string, title: string, principal: AuthenticatedPrincipal): Promise<string> {
		const conversation = await this.converationStore.getConversation(conversationId, principal)
		if (!conversation) {
			throw new Error("Conversation not found")
		}

		const trimmedTitle = title.trim()
		if (!trimmedTitle) {
			throw new Error("Title must not be empty")
		}

		await this.converationStore.updateConversationTitle(conversationId, trimmedTitle, principal)
		return trimmedTitle
	}

	public async generateSummary(_conversationId: number) {
		// need to hook up a llm call here
		// Do this at a later stage
	}

	public async getChatHistoryFromDb(conversatonId: string, principal: AuthenticatedPrincipal): Promise<ChatHistory> {
		const result: ChatHistory = []
		//const conversation = this.converationStore.getConversation(conversatonId, principal)
		const messages = await this.converationStore.getUnsummarizedConversationMessages(conversatonId, principal)
		for (const messagePair of messages) {
			result.push(messagePair.userInput)
			result.push(messagePair.response)
		}
		return result
	}

	public async getOrCreateConversationId(conversatonId: string | null, principal: AuthenticatedPrincipal): Promise<string> {
		if (conversatonId) {
			// Don't trust a client-supplied id blindly - it must actually belong to this principal.
			const existing = await this.converationStore.getConversation(conversatonId, principal)
			if (existing) {
				return conversatonId
			}
		}

		const newConversation: NewConversation = {
			owner: principal.userId,
			createdAt: new Date(),
			updatedAt: new Date()
		}
		const conversation = await this.converationStore.createConversation(newConversation, principal)
		return conversation.id
	}

	public async appendConversationMessage(conversatonId: string | null, userInput: ChatInputItem, response: ChatResponseObject, principal: AuthenticatedPrincipal): Promise<ConversationMessagePair> {
		const resolvedConversationId = await this.getOrCreateConversationId(conversatonId, principal)

		// Every save path (a normal turn, an import, an incognito conversation being saved) comes through
		// here, so this is the one place attachments leave the message for storage
		const storedUserInput = this.attachmentBlobStore
			? await moveAttachmentsToStorage({ userInput, conversationId: resolvedConversationId, principal, conversationStore: this.converationStore, blobStore: this.attachmentBlobStore })
			: userInput

		const pair: NewConversationMessagePair = {
			userInput: storedUserInput,
			response: response,
			owner: principal.userId,
			includedInSummary: false,
			timestamp: new Date(),
			conversationId: resolvedConversationId
		}
		return await this.converationStore.appendConversationMessage(resolvedConversationId, pair, principal)
	}

	// Bulk-persists an already-assembled history (e.g. an imported .kráa file, or a conversation that
	// was incognito from its very first message and so never got a conversationId) as a brand new,
	// real conversation. Reuses the same per-pair append used for normal turns - just called in a loop -
	// so encryption/updatedAt bookkeeping stays identical to the regular one-pair-at-a-time path.
	public async createConversationWithHistory(pairs: { userInput: ChatInputItem; response: ChatResponseObject }[], principal: AuthenticatedPrincipal): Promise<Conversation> {
		const newConversation: NewConversation = {
			owner: principal.userId,
			createdAt: new Date(),
			updatedAt: new Date()
		}
		const conversation = await this.converationStore.createConversation(newConversation, principal)
		for (const pair of pairs) {
			await this.appendConversationMessage(conversation.id, pair.userInput, pair.response, principal)
		}
		return conversation
	}

	public async listConversations(principal: AuthenticatedPrincipal): Promise<Conversation[]> {
		return await this.converationStore.getConversations(principal)
	}

	public async getConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<Conversation | null> {
		return await this.converationStore.getConversation(conversationId, principal)
	}

	// Loads stored attachments (refs) in inputs back into data URLs - see loadStoredAttachments. Safe with a
	// client-supplied conversationId: only a conversation the principal owns has any entries to load from.
	public async loadStoredAttachments(inputs: ChatInputItem[], conversationId: string | undefined, principal: AuthenticatedPrincipal): Promise<ChatInputItem[]> {
		if (!this.attachmentBlobStore) {
			return inputs
		}
		return await loadStoredAttachments({ conversationStore: this.converationStore, blobStore: this.attachmentBlobStore }, inputs, conversationId, principal)
	}

	// One stored attachment for download/display, or null if it isn't the principal's (or doesn't exist)
	public async readStoredAttachment(conversationId: string, objectId: string, principal: AuthenticatedPrincipal): Promise<{ entry: ConversationAttachmentEntry; bytes: Uint8Array } | null> {
		if (!this.attachmentBlobStore) {
			return null
		}
		return await readStoredAttachment({ conversationStore: this.converationStore, blobStore: this.attachmentBlobStore }, conversationId, objectId, principal)
	}

	public async deleteConversation(conversationId: string, principal: AuthenticatedPrincipal): Promise<void> {
		await this.converationStore.deleteConversationMessages(conversationId, principal)
		// The caller has checked ownership; the prefix is built from principal.userId either way. A failure only
		// leaves unreachable (encrypted) objects behind - their keys go with the header below - so it doesn't
		// stop the conversation from being deleted.
		if (this.attachmentBlobStore) {
			await this.attachmentBlobStore.deletePrefix(conversationAttachmentPrefix(principal.userId, conversationId)).catch((error) => {
				logger.errorException(error, "Failed to delete the attachments of conversation {conversationId} from storage", conversationId)
			})
		}
		await this.converationStore.deleteConversation(conversationId, principal)
	}
}
