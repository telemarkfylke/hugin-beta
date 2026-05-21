import { afterEach, describe, expect, it, vi } from "vitest"
import type { ChatConfig } from "$lib/types/chat"
import { deleteChatConfig, saveChatConfig, updateChatConfig } from "./chat-config-client"

const mockConfig: ChatConfig = {
	_id: "config-123",
	name: "Test Config",
	description: "A test config",
	vendorId: "MISTRAL",
	project: "test-project",
	accessGroups: ["all"],
	type: "private",
	created: { at: "2024-01-01T00:00:00Z", by: { id: "user-1", name: "User One" } },
	updated: { at: "2024-01-01T00:00:00Z", by: { id: "user-1", name: "User One" } }
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("saveChatConfig", () => {
	it("happy path: POSTs to /api/chatconfigs and returns parsed config", async () => {
		const savedConfig: ChatConfig = { ...mockConfig, _id: "saved-456" }
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(savedConfig)
			})
		)

		const result = await saveChatConfig(mockConfig)

		expect(fetch).toHaveBeenCalledWith("/api/chatconfigs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mockConfig)
		})
		expect(result).toEqual(savedConfig)
	})

	it("non-ok response: throws error containing status code", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				json: vi.fn().mockResolvedValue({ message: "Validation failed" })
			})
		)

		await expect(saveChatConfig(mockConfig)).rejects.toThrow("400")
	})
})

describe("updateChatConfig", () => {
	it("happy path: PUTs to /api/chatconfigs/{id} and returns parsed config", async () => {
		const updatedConfig: ChatConfig = { ...mockConfig, name: "Updated Name" }
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue(updatedConfig)
			})
		)

		const result = await updateChatConfig(mockConfig)

		expect(fetch).toHaveBeenCalledWith(`/api/chatconfigs/${mockConfig._id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mockConfig)
		})
		expect(result).toEqual(updatedConfig)
	})

	it("non-ok response: throws error containing status code", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
				json: vi.fn().mockResolvedValue({ message: "Config not found" })
			})
		)

		await expect(updateChatConfig(mockConfig)).rejects.toThrow("404")
	})
})

describe("deleteChatConfig", () => {
	it("happy path: DELETEs /api/chatconfigs/{id} and resolves void", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockResolvedValue({})
			})
		)

		const result = await deleteChatConfig("config-123")

		expect(fetch).toHaveBeenCalledWith("/api/chatconfigs/config-123", {
			method: "DELETE"
		})
		expect(result).toBeUndefined()
	})

	it("non-ok response: throws error containing status code", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				statusText: "Forbidden",
				json: vi.fn().mockResolvedValue({ message: "Not authorized" })
			})
		)

		await expect(deleteChatConfig("config-123")).rejects.toThrow("403")
	})
})
