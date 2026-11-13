import { describe, expect, it, vi } from "vitest"

vi.mock("@vestfoldfylke/loglady", () => ({ logger: { warn: vi.fn(), error: vi.fn(), errorException: vi.fn(), info: vi.fn() } }))

import { attachmentId, listConversationAttachments, withUnresolvedAttachmentsAsNotes } from "$lib/chat-history"
import type { IAttachmentBlobStore } from "$lib/conversationattachments/server/adapters/interface"
import { MockAttachmentBlobStore } from "$lib/conversationattachments/server/adapters/mock-attachment-blob-store"
import { attachmentAad, decryptAttachment } from "$lib/conversationattachments/server/attachment-crypto"
import { conversationAttachmentKey } from "$lib/conversationattachments/server/attachment-keys"
import { parseBase64DataUrl } from "$lib/conversationattachments/server/data-url"
import { moveAttachmentsToStorage } from "$lib/conversationattachments/server/store-attachments"
import { MockConversationStore } from "$lib/conversationstore/server/adapters/mock-conversation-store"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputFile, InputImage } from "$lib/types/chat-item-content"

const kari = { userId: "kari" } as AuthenticatedPrincipal
const pdfBytes = new TextEncoder().encode("%PDF-1.7 innhold")
const pdfUrl = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`
const pngUrl = `data:image/png;base64,${Buffer.from([137, 80, 78, 71]).toString("base64")}`

const message = (...content: ChatInputMessage["content"]): ChatInputMessage => ({ type: "message.input", role: "user", content })

const setup = async () => {
	const conversationStore = new MockConversationStore()
	const blobStore = new MockAttachmentBlobStore()
	const conversation = await conversationStore.createConversation({ owner: "kari", createdAt: new Date(), updatedAt: new Date() }, kari)
	const move = (userInput: ChatInputItem, store: IAttachmentBlobStore = blobStore) =>
		moveAttachmentsToStorage({ userInput, conversationId: conversation.id, principal: kari, conversationStore, blobStore: store })
	return { conversationStore, blobStore, conversationId: conversation.id, move }
}

describe("parseBase64DataUrl", () => {
	it("splits a data URL into type and bytes", () => {
		expect(parseBase64DataUrl(pdfUrl)).toEqual({ mimeType: "application/pdf", bytes: pdfBytes })
		expect(parseBase64DataUrl("data:text/plain;charset=utf-8;base64,aGVp")?.mimeType).toBe("text/plain")
	})

	it.each(["", "https://example.com/a.pdf", "data:text/plain,hei", "data:;base64,aGVp"])("returns null for %j", (url) => {
		expect(parseBase64DataUrl(url)).toBeNull()
	})
})

describe("moveAttachmentsToStorage", () => {
	it("replaces data URLs with refs, stores encrypted bytes and records the entry in the header", async () => {
		const { conversationStore, blobStore, conversationId, move } = await setup()
		const stored = (await move(message({ type: "input_text", text: "se på denne" }, { type: "input_file", fileName: "rapport.pdf", fileUrl: pdfUrl }))) as ChatInputMessage

		const file = stored.content[1] as InputFile
		expect(stored.content[0]).toEqual({ type: "input_text", text: "se på denne" })
		expect(file.fileUrl).toBe("")
		expect(file.fileName).toBe("rapport.pdf")
		expect(file.ref).toMatchObject({ sha256: await attachmentId({ type: "input_file", fileName: "rapport.pdf", fileUrl: pdfUrl }), mimeType: "application/pdf", size: pdfBytes.length })

		const [entry] = await conversationStore.getConversationAttachments(conversationId, kari)
		expect(entry).toMatchObject({ objectId: file.ref?.objectId, fileName: "rapport.pdf", mimeType: "application/pdf" })
		const ciphertext = await blobStore.get(conversationAttachmentKey("kari", conversationId, file.ref?.objectId ?? ""))
		expect(ciphertext).not.toBeNull()
		expect(decryptAttachment(ciphertext as Uint8Array, entry?.fileKey ?? "", attachmentAad("kari", conversationId, file.ref?.objectId ?? ""))).toEqual(pdfBytes)
	})

	it("keeps the attachment's id, so arming and the file list see the same file before and after storing", async () => {
		const { move } = await setup()
		const inline: InputImage = { type: "input_image", imageUrl: pngUrl }
		const stored = (await move(message(inline))) as ChatInputMessage
		expect(await attachmentId(stored.content[0] as InputImage)).toBe(await attachmentId(inline))
		expect(await listConversationAttachments([stored])).toEqual(await listConversationAttachments([message(inline)]))
	})

	it("reuses a file already stored in the same conversation instead of storing it again", async () => {
		const { conversationStore, conversationId, blobStore, move } = await setup()
		const putSpy = vi.spyOn(blobStore, "put")
		const first = (await move(message({ type: "input_file", fileName: "a.pdf", fileUrl: pdfUrl }))) as ChatInputMessage
		const second = (await move(message({ type: "input_file", fileName: "kopi.pdf", fileUrl: pdfUrl }))) as ChatInputMessage

		expect(putSpy).toHaveBeenCalledTimes(1)
		expect((second.content[0] as InputFile).ref?.objectId).toBe((first.content[0] as InputFile).ref?.objectId)
		expect((second.content[0] as InputFile).fileName).toBe("kopi.pdf")
		expect(await conversationStore.getConversationAttachments(conversationId, kari)).toHaveLength(1)
	})

	it("saves the message with a note instead of the file when storing fails", async () => {
		const { conversationStore, conversationId, move } = await setup()
		const failing: IAttachmentBlobStore = { put: async () => Promise.reject(new Error("S3 nede")), get: async () => null, deletePrefix: async () => {} }
		const stored = (await move(message({ type: "input_text", text: "hei" }, { type: "input_file", fileName: "rapport.pdf", fileUrl: pdfUrl }), failing)) as ChatInputMessage

		expect(stored.content).toEqual([
			{ type: "input_text", text: "hei" },
			{ type: "input_text", text: "[Vedlegg «rapport.pdf» kunne ikke lagres.]" }
		])
		expect(await conversationStore.getConversationAttachments(conversationId, kari)).toEqual([])
	})

	it("leaves messages without inline attachments untouched", async () => {
		const { move } = await setup()
		const alreadyStored = message({ type: "input_file", fileName: "a.pdf", fileUrl: "", ref: { sha256: "a".repeat(64), objectId: "b".repeat(32), mimeType: "application/pdf", size: 1 } })
		expect(await move(alreadyStored)).toBe(alreadyStored)
		const textOnly = message({ type: "input_text", text: "hei" })
		expect(await move(textOnly)).toBe(textOnly)
	})
})

describe("withUnresolvedAttachmentsAsNotes", () => {
	const ref = { sha256: "a".repeat(64), objectId: "b".repeat(32), mimeType: "application/pdf", size: 1 }

	it("turns stored-but-not-loaded attachments into notes so they're never sent as empty files", () => {
		const out = withUnresolvedAttachmentsAsNotes(message({ type: "input_text", text: "hei" }, { type: "input_file", fileName: "a.pdf", fileUrl: "", ref }, { type: "input_image", imageUrl: "", ref }))
		expect(out.content).toEqual([
			{ type: "input_text", text: "hei" },
			{ type: "input_text", text: "[Vedlegg «a.pdf» ble lagt ved tidligere i samtalen, men er ikke tilgjengelig nå.]" },
			{ type: "input_text", text: "[Vedlegg (bilde) ble lagt ved tidligere i samtalen, men er ikke tilgjengelig nå.]" }
		])
	})

	it("leaves loaded and inline attachments alone", () => {
		const loaded = message({ type: "input_file", fileName: "a.pdf", fileUrl: pdfUrl, ref }, { type: "input_image", imageUrl: pngUrl })
		expect(withUnresolvedAttachmentsAsNotes(loaded)).toBe(loaded)
	})
})
