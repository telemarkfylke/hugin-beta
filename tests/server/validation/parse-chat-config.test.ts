import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatConfig } from "$lib/types/chat"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

const appConfig: AppConfig = {
	NAME: "Hugin test",
	BODY_SIZE_LIMIT_BYTES: 1024 * 1024,
	APP_ROLES: {
		ADMIN: "Admin",
		AGENT_MAINTAINER: "AgentMaintainer",
		EMPLOYEE: "Employee",
		STUDENT: "Student",
		EDU_EMPLOYEE: "EduEmployee"
	},
	CONVERSATION_EXPORT_DISABLED: false,
	NEW_CHAT_CONFIRM_DISABLED: false,
	VENDORS: {
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			MODELS: [{ ID: "gpt-4.1", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: ["application/pdf"], IMAGE: ["image/png"] } }]
		},
		MISTRAL: { NAME: "Mistral", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] },
		OLLAMA: { NAME: "Ollama", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] },
		LITELLM: { NAME: "LiteLLM", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] }
	}
}

const validConfig = (overrides: Partial<ChatConfig> = {}): ChatConfig => ({
	_id: "config-1",
	name: "Config",
	description: "Description",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	instructions: "Be helpful",
	type: "private",
	accessGroups: ["all"],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1", name: "Owner" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1", name: "Owner" } },
	...overrides
})

describe("parseChatConfig", () => {
	it("parses valid manual configs", () => {
		expect(parseChatConfig(validConfig(), appConfig)).toEqual(validConfig({ tools: [] }))
	})

	it("parses valid predefined vendor-agent configs", () => {
		const input = validConfig({ model: undefined, instructions: undefined, vendorAgent: { id: "agent-1" }, tools: [{ type: "web_search" }] })

		expect(parseChatConfig(input, appConfig)).toEqual({
			_id: "config-1",
			name: "Config",
			description: "Description",
			vendorId: "OPENAI",
			project: "DEFAULT",
			vendorAgent: { id: "agent-1" },
			shared: undefined,
			accessGroups: ["all"],
			type: "private",
			created: input.created,
			updated: input.updated
		})
	})

	it("throws HTTPError for invalid config shape", () => {
		expect(() => parseChatConfig({ vendorId: "OPENAI" }, appConfig)).toThrow(HTTPError)
	})

	it("throws HTTPError for unsupported project", () => {
		expect(() => parseChatConfig(validConfig({ project: "OTHER" }), appConfig)).toThrow(HTTPError)
	})

	it("throws HTTPError for unsupported model", () => {
		expect(() => parseChatConfig(validConfig({ model: "unknown-model" }), appConfig)).toThrow(HTTPError)
	})

	it("throws HTTPError for disabled vendors", () => {
		expect(() => parseChatConfig(validConfig({ vendorId: "MISTRAL", model: "mistral-large-latest" }), appConfig)).toThrow(HTTPError)
	})
})
