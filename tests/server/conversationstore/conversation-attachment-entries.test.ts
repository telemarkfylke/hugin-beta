import { randomBytes } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { ConversationAttachmentEntry } from "../../../src/lib/conversationattachments/types"

const entry: ConversationAttachmentEntry = {
	sha256: "a".repeat(64),
	objectId: "obj1",
	mimeType: "application/pdf",
	size: 1234,
	fileName: "rapport.pdf",
	fileKey: randomBytes(32).toString("base64"),
	createdAt: "2026-11-13T10:00:00.000Z"
}

const loadStore = async (env: Record<string, string>) => {
	vi.resetModules()
	vi.doMock("$env/dynamic/private", () => ({ env }))
	return await import("../../../src/lib/conversationstore/server/adapters/conversation-store")
}

const withKeys = () => ({
	CONVERSATION_ENCRYPTION_KEYS: JSON.stringify({ "test-1": randomBytes(32).toString("base64") }),
	CONVERSATION_ENCRYPTION_ACTIVE_KEY: "test-1"
})

describe("conversation header attachment entries", () => {
	it("encrypts each entry on its own, with only the object id in clear", async () => {
		const { toDbConversationAttachment, fromDbConversationAttachment } = await loadStore(withKeys())
		const doc = toDbConversationAttachment(entry, "kari", "conv1")
		expect(doc.objectId).toBe("obj1")
		expect(doc.entry).toBeUndefined()
		expect(doc.encryptionKeyVersion).toBe("test-1")
		expect(JSON.stringify(doc)).not.toContain("rapport.pdf")
		expect(JSON.stringify(doc)).not.toContain(entry.fileKey)
		expect(fromDbConversationAttachment(doc, "kari", "conv1")).toEqual(entry)
	})

	it("returns null (not a throw) when the entry is bound to another owner or conversation", async () => {
		const { toDbConversationAttachment, fromDbConversationAttachment } = await loadStore(withKeys())
		const doc = toDbConversationAttachment(entry, "kari", "conv1")
		expect(fromDbConversationAttachment(doc, "ola", "conv1")).toBeNull()
		expect(fromDbConversationAttachment(doc, "kari", "conv2")).toBeNull()
	})

	it("returns null when the clear object id was swapped", async () => {
		const { toDbConversationAttachment, fromDbConversationAttachment } = await loadStore(withKeys())
		const doc = toDbConversationAttachment(entry, "kari", "conv1")
		expect(fromDbConversationAttachment({ ...doc, objectId: "obj2" }, "kari", "conv1")).toBeNull()
	})

	it("stores the entry as-is when encryption isn't configured", async () => {
		const { toDbConversationAttachment, fromDbConversationAttachment } = await loadStore({})
		const doc = toDbConversationAttachment(entry, "kari", "conv1")
		expect(doc).toEqual({ objectId: "obj1", entry })
		expect(fromDbConversationAttachment(doc, "kari", "conv1")).toEqual(entry)
	})

	it("ignores a malformed entry", async () => {
		const { fromDbConversationAttachment } = await loadStore(withKeys())
		expect(fromDbConversationAttachment({ objectId: "obj1", data: "abc" }, "kari", "conv1")).toBeNull()
	})
})

describe("MockConversationStore attachments", () => {
	it("keeps the list out of Conversation, appends in order, scopes by owner and clears on delete", async () => {
		vi.resetModules()
		const { MockConversationStore } = await import("../../../src/lib/conversationstore/server/adapters/mock-conversation-store")
		const store = new MockConversationStore()
		const kari = { userId: "kari" } as Parameters<typeof store.getConversation>[1]
		const ola = { userId: "ola" } as Parameters<typeof store.getConversation>[1]
		const conversation = await store.createConversation({ owner: "kari", createdAt: new Date(), updatedAt: new Date() }, kari)

		await store.addConversationAttachment(conversation.id, entry, kari)
		await store.addConversationAttachment(conversation.id, { ...entry, objectId: "obj2" }, kari)
		await expect(store.addConversationAttachment(conversation.id, entry, ola)).rejects.toThrow()

		expect((await store.getConversationAttachments(conversation.id, kari)).map((e) => e.objectId)).toEqual(["obj1", "obj2"])
		expect(await store.getConversationAttachments(conversation.id, ola)).toEqual([])
		expect(await store.getConversation(conversation.id, kari)).not.toHaveProperty("attachments")

		await store.deleteConversation(conversation.id, kari)
		expect(await store.getConversationAttachments(conversation.id, kari)).toEqual([])
	})
})
