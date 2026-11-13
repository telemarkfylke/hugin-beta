import { describe, expect, it, vi } from "vitest"

vi.mock("@vestfoldfylke/loglady", () => ({ logger: { warn: vi.fn(), error: vi.fn(), errorException: vi.fn(), info: vi.fn() } }))

import { attachmentId } from "$lib/chat-history"
import { MockAttachmentBlobStore } from "$lib/conversationattachments/server/adapters/mock-attachment-blob-store"
import { conversationAttachmentPrefix } from "$lib/conversationattachments/server/attachment-keys"
import { MockConversationStore } from "$lib/conversationstore/server/adapters/mock-conversation-store"
import { ConversationManager } from "$lib/conversationstore/server/conv_manager"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputFile, InputImage } from "$lib/types/chat-item-content"

const kari = { userId: "kari" } as AuthenticatedPrincipal
const ola = { userId: "ola" } as AuthenticatedPrincipal
const pdfUrl = `data:application/pdf;base64,${Buffer.from("%PDF-1.7 innhold").toString("base64")}`
const pngUrl = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 1, 2]).toString("base64")}`

const message = (...content: ChatInputMessage["content"]): ChatInputMessage => ({ type: "message.input", role: "user", content })
const response = { type: "chat_response", id: "r1", status: "completed", outputs: [], createdAt: "", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } } as unknown as ChatResponseObject

const setup = async () => {
	const conversationStore = new MockConversationStore()
	const blobStore = new MockAttachmentBlobStore()
	const manager = new ConversationManager(conversationStore, blobStore)
	const conversation = await conversationStore.createConversation({ owner: "kari", createdAt: new Date(), updatedAt: new Date() }, kari)
	// Stores one turn with a PDF and an image and returns the stored message (with refs)
	const stored = await manager.appendConversationMessage(
		conversation.id,
		message({ type: "input_text", text: "se her" }, { type: "input_file", fileName: "rapport.pdf", fileUrl: pdfUrl }, { type: "input_image", imageUrl: pngUrl }),
		response,
		kari
	)
	return { manager, blobStore, conversationId: conversation.id, storedInput: stored.userInput as ChatInputMessage }
}

describe("ConversationManager.loadStoredAttachments", () => {
	it("puts the original data URLs back for the owner", async () => {
		const { manager, conversationId, storedInput } = await setup()
		expect((storedInput.content[1] as InputFile).fileUrl).toBe("")

		const [loaded] = (await manager.loadStoredAttachments([storedInput], conversationId, kari)) as ChatInputMessage[]
		expect((loaded?.content[1] as InputFile).fileUrl).toBe(pdfUrl)
		expect((loaded?.content[2] as InputImage).imageUrl).toBe(pngUrl)
		expect(loaded?.content[0]).toEqual({ type: "input_text", text: "se her" })
		// Same id after the round trip, so arming keeps working
		expect(await attachmentId(loaded?.content[1] as InputFile)).toBe(await attachmentId({ type: "input_file", fileName: "rapport.pdf", fileUrl: pdfUrl }))
	})

	it("loads nothing for another user, even with the right conversation and object ids", async () => {
		const { manager, conversationId, storedInput } = await setup()
		const [loaded] = (await manager.loadStoredAttachments([storedInput], conversationId, ola)) as ChatInputMessage[]
		expect((loaded?.content[1] as InputFile).fileUrl).toBe("")
		expect((loaded?.content[2] as InputImage).imageUrl).toBe("")
	})

	it("leaves refs unresolved without a conversation id, and when the ref's sha256 doesn't match the stored file", async () => {
		const { manager, conversationId, storedInput } = await setup()
		expect(await manager.loadStoredAttachments([storedInput], undefined, kari)).toEqual([storedInput])

		const file = storedInput.content[1] as InputFile
		const forged = message({ ...file, ref: { ...(file.ref as NonNullable<InputFile["ref"]>), sha256: "f".repeat(64) } })
		const [loaded] = (await manager.loadStoredAttachments([forged], conversationId, kari)) as ChatInputMessage[]
		expect((loaded?.content[0] as InputFile).fileUrl).toBe("")
	})

	it("leaves a ref unresolved when its object is gone from storage", async () => {
		const { manager, blobStore, conversationId, storedInput } = await setup()
		await blobStore.deletePrefix(conversationAttachmentPrefix("kari", conversationId))
		const [loaded] = (await manager.loadStoredAttachments([storedInput], conversationId, kari)) as ChatInputMessage[]
		expect((loaded?.content[1] as InputFile).fileUrl).toBe("")
	})

	it("returns inputs untouched when nothing needs loading", async () => {
		const { manager, conversationId } = await setup()
		const inputs: ChatInputItem[] = [message({ type: "input_file", fileName: "a.pdf", fileUrl: pdfUrl })]
		expect(await manager.loadStoredAttachments(inputs, conversationId, kari)).toBe(inputs)
	})

	it("does nothing without attachment storage", async () => {
		const { conversationId, storedInput } = await setup()
		const withoutStorage = new ConversationManager(new MockConversationStore(), null)
		expect(await withoutStorage.loadStoredAttachments([storedInput], conversationId, kari)).toEqual([storedInput])
	})
})

describe("ConversationManager.readStoredAttachment / deleteConversation", () => {
	it("returns the decrypted file for the owner only", async () => {
		const { manager, conversationId, storedInput } = await setup()
		const objectId = (storedInput.content[1] as InputFile).ref?.objectId ?? ""
		const stored = await manager.readStoredAttachment(conversationId, objectId, kari)
		expect(stored?.entry.fileName).toBe("rapport.pdf")
		expect(Buffer.from(stored?.bytes ?? []).toString()).toBe("%PDF-1.7 innhold")
		expect(await manager.readStoredAttachment(conversationId, objectId, ola)).toBeNull()
		expect(await manager.readStoredAttachment(conversationId, "0".repeat(32), kari)).toBeNull()
	})

	it("deletes the conversation's files from storage with the conversation", async () => {
		const { manager, blobStore, conversationId, storedInput } = await setup()
		const objectId = (storedInput.content[1] as InputFile).ref?.objectId ?? ""
		await manager.deleteConversation(conversationId, kari)
		expect(await blobStore.get(`${conversationAttachmentPrefix("kari", conversationId)}${objectId}`)).toBeNull()
		expect(await manager.readStoredAttachment(conversationId, objectId, kari)).toBeNull()
	})
})
