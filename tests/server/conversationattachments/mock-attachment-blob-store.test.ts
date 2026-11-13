import { describe, expect, it } from "vitest"
import { MockAttachmentBlobStore } from "$lib/conversationattachments/server/adapters/mock-attachment-blob-store"

describe("MockAttachmentBlobStore", () => {
	it("stores, returns and deletes by prefix", async () => {
		const store = new MockAttachmentBlobStore()
		await store.put("conversation-attachments/u/c1/a", new Uint8Array([1, 2]))
		await store.put("conversation-attachments/u/c1/b", new Uint8Array([3]))
		await store.put("conversation-attachments/u/c2/a", new Uint8Array([4]))

		expect(await store.get("conversation-attachments/u/c1/a")).toEqual(new Uint8Array([1, 2]))
		expect(await store.get("conversation-attachments/u/c1/missing")).toBeNull()

		await store.deletePrefix("conversation-attachments/u/c1/")
		expect(await store.get("conversation-attachments/u/c1/a")).toBeNull()
		expect(await store.get("conversation-attachments/u/c1/b")).toBeNull()
		expect(await store.get("conversation-attachments/u/c2/a")).toEqual(new Uint8Array([4]))
	})

	it("keeps its own copy of the bytes", async () => {
		const store = new MockAttachmentBlobStore()
		const bytes = new Uint8Array([1, 2, 3])
		await store.put("k", bytes)
		bytes[0] = 9
		expect(await store.get("k")).toEqual(new Uint8Array([1, 2, 3]))
	})
})
