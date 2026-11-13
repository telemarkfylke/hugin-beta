import { describe, expect, it } from "vitest"
import { conversationAttachmentKey, conversationAttachmentPrefix } from "$lib/conversationattachments/server/attachment-keys"

describe("attachment-keys", () => {
	it("builds keys under the user's and conversation's prefix", () => {
		expect(conversationAttachmentPrefix("user-1", "conv-1")).toBe("conversation-attachments/user-1/conv-1/")
		expect(conversationAttachmentKey("user-1", "conv-1", "abc")).toBe("conversation-attachments/user-1/conv-1/abc")
	})

	it.each([
		["user", () => conversationAttachmentKey("../other", "conv-1", "abc")],
		["conversation", () => conversationAttachmentKey("user-1", "a/b", "abc")],
		["object", () => conversationAttachmentKey("user-1", "conv-1", "..")],
		["empty", () => conversationAttachmentPrefix("", "conv-1")]
	])("refuses an unsafe %s segment", (_, build) => {
		expect(build).toThrow()
	})
})
