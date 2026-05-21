import { describe, expect, it } from "vitest"
import type { ChatConfig } from "$lib/types/chat"
import { omitChatConfigId } from "$lib/validation/chat-config"

const chatConfig: ChatConfig = {
	_id: "507f1f77bcf86cd799439011",
	name: "Config",
	description: "Description",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: ["all"],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1" } }
}

describe("omitChatConfigId", () => {
	it("removes _id without mutating the input config", () => {
		const result = omitChatConfigId(chatConfig)

		expect(result).not.toHaveProperty("_id")
		expect(chatConfig._id).toBe("507f1f77bcf86cd799439011")
		expect(result.name).toBe("Config")
	})
})
