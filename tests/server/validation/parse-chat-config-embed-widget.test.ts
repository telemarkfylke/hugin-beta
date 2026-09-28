import { describe, expect, it } from "vitest"
import type { AppConfig } from "../../../src/lib/types/app-config"
import { parseChatConfig } from "../../../src/lib/validation/parse-chat-config"

const APP_CONFIG = {
	VENDORS: {
		OPENAI: { NAME: "OpenAI", ENABLED: true, PROJECTS: ["DEFAULT"], MODELS: [{ ID: "gpt-4o", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: [], IMAGE: [] } }] }
	}
} as unknown as AppConfig

const base = {
	_id: "1",
	name: "n",
	description: "d",
	vendorId: "OPENAI",
	project: "DEFAULT",
	type: "private",
	accessGroups: ["all"],
	created: { at: "now", by: { id: "u" } },
	updated: { at: "now", by: { id: "u" } }
}

describe("parseChatConfig with embed widget fields", () => {
	it("passes avatarUrl, welcomeMessage and suggestedQuestions through on a manual config", () => {
		const config = parseChatConfig(
			{ ...base, model: "gpt-4o", avatarUrl: "https://example.org/avatar.png", welcomeMessage: "Hei!", suggestedQuestions: ["Hva koster det?", "Hvor lang tid tar det?"] },
			APP_CONFIG,
			{ mode: "use" }
		)
		expect(config.avatarUrl).toBe("https://example.org/avatar.png")
		expect(config.welcomeMessage).toBe("Hei!")
		expect(config.suggestedQuestions).toEqual(["Hva koster det?", "Hvor lang tid tar det?"])
	})

	it("passes the same fields through on a predefined vendor-agent config", () => {
		const config = parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, welcomeMessage: "Hallo", suggestedQuestions: ["Spørsmål 1"] }, APP_CONFIG, { mode: "use" })
		expect(config.welcomeMessage).toBe("Hallo")
		expect(config.suggestedQuestions).toEqual(["Spørsmål 1"])
	})

	it("passes hideAttachmentButton, hideWebSearchButton and hideDataSourceButton through on a manual config", () => {
		const config = parseChatConfig({ ...base, model: "gpt-4o", hideAttachmentButton: true, hideWebSearchButton: true, hideDataSourceButton: true }, APP_CONFIG, { mode: "use" })
		expect(config.hideAttachmentButton).toBe(true)
		expect(config.hideWebSearchButton).toBe(true)
		expect(config.hideDataSourceButton).toBe(true)
	})

	it("passes the same hide* flags through on a predefined vendor-agent config", () => {
		const config = parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, hideAttachmentButton: true, hideWebSearchButton: true, hideDataSourceButton: true }, APP_CONFIG, { mode: "use" })
		expect(config.hideAttachmentButton).toBe(true)
		expect(config.hideWebSearchButton).toBe(true)
		expect(config.hideDataSourceButton).toBe(true)
	})

	it("leaves the fields undefined when entirely absent (pre-existing config shape)", () => {
		const config = parseChatConfig({ ...base, model: "gpt-4o" }, APP_CONFIG, { mode: "use" })
		expect(config.avatarUrl).toBeUndefined()
		expect(config.welcomeMessage).toBeUndefined()
		expect(config.suggestedQuestions).toBeUndefined()
		expect(config.hideAttachmentButton).toBeUndefined()
		expect(config.hideWebSearchButton).toBeUndefined()
		expect(config.hideDataSourceButton).toBeUndefined()
	})
})
