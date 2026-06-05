import { describe, expect, it } from "vitest"
import { parseChatConfig } from "../../../src/lib/validation/parse-chat-config"
import { HTTPError } from "../../../src/lib/server/middleware/http-error"
import type { AppConfig } from "../../../src/lib/types/app-config"

const MOCK_APP_CONFIG: AppConfig = {
	NAME: "Test App",
	BODY_SIZE_LIMIT_BYTES: 10_000_000,
	NEW_CHAT_CONFIRM_DISABLED: false,
	TRANSCRIPTION_GROUPS: [],
	APP_ROLES: {
		ADMIN: "Admin",
		AGENT_MAINTAINER: "AgentMaintainer",
		EMPLOYEE: "Employee",
		STUDENT: "Student",
		EDU_EMPLOYEE: "EduEmployee"
	},
	VENDORS: {
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: ["application/pdf"],
			SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: ["image/png", "image/jpeg"]
		},
		MISTRAL: {
			NAME: "Mistral",
			ENABLED: false,
			PROJECTS: ["DEFAULT"],
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: [],
			SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: []
		}
	}
}

const VALID_BASE = {
	_id: "config-1",
	name: "Test Config",
	description: "A test config",
	vendorId: "OPENAI",
	project: "DEFAULT",
	type: "published",
	accessGroups: ["employee"],
	created: { at: "2024-01-01T00:00:00Z", by: { id: "user-1" } },
	updated: { at: "2024-01-01T00:00:00Z", by: { id: "user-1" } }
}

describe("parseChatConfig", () => {
	it("throws HTTPError(400) when input is null", () => {
		expect(() => parseChatConfig(null, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(null, MOCK_APP_CONFIG)
		} catch (err) {
			expect(err).toBeInstanceOf(HTTPError)
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when input is a string", () => {
		expect(() => parseChatConfig("not-an-object", MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig("not-an-object", MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when input is a number", () => {
		expect(() => parseChatConfig(42, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(42, MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when Zod validation fails (missing required field)", () => {
		const input = { ...VALID_BASE }
		// biome-ignore lint/performance/noDelete: intentional removal for test
		delete (input as Record<string, unknown>)["name"]
		expect(() => parseChatConfig(input, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(input, MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when vendorId is not in APP_CONFIG.VENDORS", () => {
		const input = { ...VALID_BASE, vendorId: "ANTHROPIC" }
		expect(() => parseChatConfig(input, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(input, MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when project is not in VENDOR.PROJECTS", () => {
		const input = { ...VALID_BASE, project: "NONEXISTENT" }
		expect(() => parseChatConfig(input, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(input, MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("throws HTTPError(400) when vendor is not ENABLED", () => {
		const input = { ...VALID_BASE, vendorId: "MISTRAL" }
		expect(() => parseChatConfig(input, MOCK_APP_CONFIG)).toThrow(HTTPError)
		try {
			parseChatConfig(input, MOCK_APP_CONFIG)
		} catch (err) {
			expect((err as HTTPError).status).toBe(400)
		}
	})

	it("returns correct ChatConfig for a valid manual config (no vendorAgent)", () => {
		const input = {
			...VALID_BASE,
			instructions: "You are a helpful assistant.",
			tools: [{ type: "web_search" }]
		}
		const result = parseChatConfig(input, MOCK_APP_CONFIG)
		expect(result._id).toBe("config-1")
		expect(result.name).toBe("Test Config")
		expect(result.vendorId).toBe("OPENAI")
		expect(result.project).toBe("DEFAULT")
		expect(result.instructions).toBe("You are a helpful assistant.")
		expect(result.tools).toEqual([{ type: "web_search" }])
		expect(result.vendorAgent).toBeUndefined()
	})

	it("returns correct ChatConfig for a valid vendorAgent config", () => {
		const input = {
			...VALID_BASE,
			vendorAgent: { id: "agent-abc-123" }
		}
		const result = parseChatConfig(input, MOCK_APP_CONFIG)
		expect(result._id).toBe("config-1")
		expect(result.vendorId).toBe("OPENAI")
		expect(result.vendorAgent).toEqual({ id: "agent-abc-123" })
		expect(result.instructions).toBeUndefined()
		expect(result.tools).toBeUndefined()
	})
})
