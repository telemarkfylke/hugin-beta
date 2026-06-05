import { describe, expect, it } from "vitest"
import { canPromptConfig, canEditChatConfig } from "../../../src/lib/authorization"
import type { AppConfig } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"
import type { Chat, ChatConfig } from "../../../src/lib/types/chat"

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
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: [],
			SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: []
		}
	}
}

const makeUser = (roles: string[], groups: string[] = [], userId = "user-1"): AuthenticatedPrincipal => ({
	userId,
	name: "Test User",
	preferredUserName: "test.user@example.com",
	roles,
	groups
})

const makePublishedConfig = (overrides: Partial<ChatConfig> = {}): ChatConfig => ({
	_id: "config-1",
	name: "Published Config",
	description: "A published config",
	vendorId: "OPENAI",
	project: "DEFAULT",
	type: "published",
	accessGroups: ["employee"],
	created: { at: "2024-01-01T00:00:00Z", by: { id: "owner-1" } },
	updated: { at: "2024-01-01T00:00:00Z", by: { id: "owner-1" } },
	...overrides
})

const makePrivateConfig = (overrides: Partial<ChatConfig> = {}): ChatConfig => ({
	_id: "config-2",
	name: "Private Config",
	description: "A private config",
	vendorId: "OPENAI",
	project: "DEFAULT",
	type: "private",
	accessGroups: [],
	created: { at: "2024-01-01T00:00:00Z", by: { id: "user-1" } },
	updated: { at: "2024-01-01T00:00:00Z", by: { id: "user-1" } },
	...overrides
})

const makeChat = (config: ChatConfig, ownerId = "user-1"): Chat => ({
	_id: "chat-1",
	config,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	owner: { id: ownerId }
})

describe("canPromptConfig", () => {
	it("returns true for Employee role with type 'published' and accessGroups=['employee']", () => {
		const user = makeUser(["Employee"])
		const config = makePublishedConfig({ accessGroups: ["employee"] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})

	it("returns true for Admin role regardless of config type or accessGroups", () => {
		const user = makeUser(["Admin"])
		const config = makePublishedConfig({ accessGroups: [] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})

	it("returns false for Student role with type 'published' and no student access group", () => {
		const user = makeUser(["Student"])
		const config = makePublishedConfig({ accessGroups: ["employee"] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(false)
	})

	it("returns true for Student role when config accessGroups includes 'student'", () => {
		const user = makeUser(["Student"])
		const config = makePublishedConfig({ accessGroups: ["student"] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})

	it("returns true when config type is 'private' and user is the owner", () => {
		const user = makeUser(["Employee"], [], "owner-1")
		const config = makePrivateConfig({ created: { at: "2024-01-01T00:00:00Z", by: { id: "owner-1" } } })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})

	it("returns false when config type is 'private' and user is not the owner", () => {
		const user = makeUser(["Employee"], [], "other-user")
		const config = makePrivateConfig({ created: { at: "2024-01-01T00:00:00Z", by: { id: "owner-1" } } })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(false)
	})

	it("returns false when user has no matching role or group", () => {
		const user = makeUser([], [])
		const config = makePublishedConfig({ accessGroups: ["employee"] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(false)
	})

	it("returns true when config has shared=true regardless of role", () => {
		const user = makeUser([])
		const config = makePublishedConfig({ shared: true, accessGroups: [] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})

	it("returns true when user is in a matching Entra group", () => {
		const user = makeUser(["Employee"], ["group-abc-123"])
		const config = makePublishedConfig({ accessGroups: [{ id: "group-abc-123", displayName: "Some Group" }] })
		expect(canPromptConfig(user, MOCK_APP_CONFIG, config)).toBe(true)
	})
})

describe("canEditChatConfig", () => {
	it("returns true for Admin", () => {
		const user = makeUser(["Admin"])
		const config = makePublishedConfig()
		const chat = makeChat(config)
		expect(canEditChatConfig(chat, user, MOCK_APP_CONFIG.APP_ROLES)).toBe(true)
	})

	it("returns true for AgentMaintainer on a published config", () => {
		const user = makeUser(["AgentMaintainer"])
		const config = makePublishedConfig()
		const chat = makeChat(config)
		expect(canEditChatConfig(chat, user, MOCK_APP_CONFIG.APP_ROLES)).toBe(true)
	})

	it("returns true for the owner of a private config", () => {
		const user = makeUser(["Employee"], [], "owner-1")
		const config = makePrivateConfig({ created: { at: "2024-01-01T00:00:00Z", by: { id: "owner-1" } } })
		const chat = makeChat(config, "owner-1")
		expect(canEditChatConfig(chat, user, MOCK_APP_CONFIG.APP_ROLES)).toBe(true)
	})

	it("returns false for Employee on a published config they do not own", () => {
		const user = makeUser(["Employee"], [], "user-99")
		const config = makePublishedConfig()
		const chat = makeChat(config)
		expect(canEditChatConfig(chat, user, MOCK_APP_CONFIG.APP_ROLES)).toBe(false)
	})

	it("returns true when config._id is empty (new unsaved config)", () => {
		const user = makeUser(["Employee"])
		const config = makePublishedConfig({ _id: "" })
		const chat = makeChat(config)
		expect(canEditChatConfig(chat, user, MOCK_APP_CONFIG.APP_ROLES)).toBe(true)
	})
})
