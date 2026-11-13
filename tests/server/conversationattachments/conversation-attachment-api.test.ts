import type { RequestEvent } from "@sveltejs/kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ConversationAttachmentEntry } from "$lib/conversationattachments/types"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { GET } from "../../../src/routes/api/conversation-attachments/[conversationId]/[objectId]/+server"
import { TEST_USER_MS_HEADERS } from "../api/test-requests-data"

// Storage and ownership are tested in load-attachments.test.ts - here only what the endpoint does with the result
const manager = vi.hoisted(() => ({ readStoredAttachment: vi.fn() }))
vi.mock("$lib/conversationstore/server/get-conversation-manager", () => ({ getConversationManager: () => manager }))

const OBJECT_ID = "a".repeat(32)
const CONVERSATION_ID = "6650f1c2a1b2c3d4e5f60718"

const entry = (mimeType: string, fileName?: string): ConversationAttachmentEntry => ({
	sha256: "b".repeat(64),
	objectId: OBJECT_ID,
	mimeType,
	size: 3,
	...(fileName !== undefined && { fileName }),
	fileKey: "k",
	createdAt: ""
})

const get = (conversationId = CONVERSATION_ID, objectId = OBJECT_ID) => {
	const request = new Request(`http://hugin.test/api/conversation-attachments/${conversationId}/${objectId}`, { headers: { [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee } })
	return GET({ request, params: { conversationId, objectId }, url: new URL(request.url) } as unknown as RequestEvent)
}

beforeEach(() => {
	manager.readStoredAttachment.mockReset()
})

describe("GET /api/conversation-attachments/[conversationId]/[objectId]", () => {
	it("serves an image inline with its own type", async () => {
		manager.readStoredAttachment.mockResolvedValue({ entry: entry("image/png"), bytes: new Uint8Array([1, 2, 3]) })
		const response = await get()
		expect(response.status).toBe(200)
		expect(response.headers.get("content-type")).toBe("image/png")
		expect(response.headers.get("content-disposition")).toBeNull()
		expect(response.headers.get("cache-control")).toBe("private, no-store")
		expect(response.headers.get("x-content-type-options")).toBe("nosniff")
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
	})

	it.each(["application/pdf", "image/svg+xml", "text/html"])("serves %s only as a download", async (mimeType) => {
		manager.readStoredAttachment.mockResolvedValue({ entry: entry(mimeType, "rapport æøå.pdf"), bytes: new Uint8Array([1]) })
		const response = await get()
		expect(response.headers.get("content-type")).toBe("application/octet-stream")
		expect(response.headers.get("content-disposition")).toBe(`attachment; filename="rapport ___.pdf"; filename*=UTF-8''${encodeURIComponent("rapport æøå.pdf")}`)
	})

	it("answers 404 for someone else's or a missing attachment, and when reading fails", async () => {
		manager.readStoredAttachment.mockResolvedValue(null)
		expect((await get()).status).toBe(404)
		manager.readStoredAttachment.mockRejectedValue(new Error("S3 nede"))
		expect((await get()).status).toBe(404)
	})

	it("rejects malformed ids without looking anything up", async () => {
		expect((await get(CONVERSATION_ID, "not-an-object-id")).status).toBe(404)
		expect((await get("../x", OBJECT_ID)).status).toBe(404)
		expect(manager.readStoredAttachment).not.toHaveBeenCalled()
	})

	it("looks the attachment up as the requesting user", async () => {
		manager.readStoredAttachment.mockResolvedValue(null)
		await get()
		expect(manager.readStoredAttachment).toHaveBeenCalledWith(CONVERSATION_ID, OBJECT_ID, expect.objectContaining({ userId: expect.any(String) }))
	})
})
