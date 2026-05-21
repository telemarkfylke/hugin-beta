// tests/server/api/chat-config-service.test.ts
import { describe, expect, it, vi } from "vitest"
import { createChatConfig, deleteChatConfig, listChatConfigs, replaceChatConfig } from "$lib/server/services/chat-config-service"
import type { AppConfig, AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"

const appRoles: AppRoles = {
	ADMIN: "Admin",
	AGENT_MAINTAINER: "AgentMaintainer",
	EMPLOYEE: "Employee",
	STUDENT: "Student",
	EDU_EMPLOYEE: "EduEmployee"
}

const appConfig = {
	NAME: "Test App",
	BODY_SIZE_LIMIT_BYTES: 10_000_000,
	CONVERSATION_EXPORT_DISABLED: false,
	NEW_CHAT_CONFIRM_DISABLED: false,
	APP_ROLES: appRoles,
	VENDORS: {
		OPENAI: {
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			MODELS: [{ ID: "gpt-4.1", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: [], IMAGE: [] } }],
			NAME: "OpenAI"
		},
		MISTRAL: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "Mistral" },
		OLLAMA: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "Ollama" },
		LITELLM: { ENABLED: false, PROJECTS: [], MODELS: [], NAME: "LiteLLM" }
	}
} as AppConfig

const user = (overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal => ({
	userId: "user-1",
	name: "User One",
	preferredUserName: "user@example.com",
	roles: ["Employee"],
	groups: [],
	...overrides
})

const existingConfig = (): ChatConfig => ({
	_id: "507f1f77bcf86cd799439011",
	name: "My Config",
	description: "Desc",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "Original Author" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "User One" } }
})

const validBody = (): unknown => ({
	_id: "507f1f77bcf86cd799439011",
	name: "My Config",
	description: "Desc",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1" } }
})

const makeStore = (overrides: Partial<IChatConfigStore> = {}): IChatConfigStore => ({
	getChatConfig: vi.fn().mockResolvedValue(existingConfig()),
	getChatConfigs: vi.fn().mockResolvedValue([existingConfig()]),
	createChatConfig: vi.fn().mockImplementation(async (cfg: NewChatConfig) => ({ ...cfg, _id: "new-id" }) as ChatConfig),
	replaceChatConfig: vi.fn().mockImplementation(async (_id: string, cfg: NewChatConfig) => ({ ...cfg, _id }) as ChatConfig),
	deleteChatConfig: vi.fn().mockResolvedValue(undefined),
	...overrides
})

describe("listChatConfigs", () => {
	it("delegates to store and returns results", async () => {
		const store = makeStore()
		const result = await listChatConfigs(user(), store)
		expect(store.getChatConfigs).toHaveBeenCalledWith(user())
		expect(result).toEqual([existingConfig()])
	})
})

describe("createChatConfig", () => {
	it("throws 400 when userId is missing", async () => {
		const u = user({ userId: "" })
		await expect(createChatConfig(validBody(), u, appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})

	it("throws 400 for invalid body", async () => {
		await expect(createChatConfig({ not: "valid" }, user(), appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})

	it("throws 403 when non-maintainer tries to create published config", async () => {
		const body = { ...(validBody() as Record<string, unknown>), type: "published" }
		await expect(createChatConfig(body, user({ roles: ["Employee"] }), appConfig, makeStore())).rejects.toMatchObject({ status: 403 })
	})

	it("allows maintainer to create published config", async () => {
		const store = makeStore()
		const body = { ...(validBody() as Record<string, unknown>), type: "published" }
		const result = await createChatConfig(body, user({ roles: ["AgentMaintainer"] }), appConfig, store)
		expect(store.createChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("new-id")
	})

	it("stamps created/updated with caller identity and current time", async () => {
		const store = makeStore()
		await createChatConfig(validBody(), user({ userId: "u-42", name: "Alice" }), appConfig, store)
		const call = vi.mocked(store.createChatConfig).mock.calls[0]?.[0]
		expect(call?.created.by.id).toBe("u-42")
		expect(call?.created.by.name).toBe("Alice")
		expect(call?.updated.by.id).toBe("u-42")
		expect(call?.created.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
		expect(call?.updated.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
	})

	it("calls store.createChatConfig without _id field", async () => {
		const store = makeStore()
		await createChatConfig(validBody(), user(), appConfig, store)
		const call = vi.mocked(store.createChatConfig).mock.calls[0]?.[0]
		expect(call).not.toHaveProperty("_id")
	})
})

describe("replaceChatConfig", () => {
	it("throws 404 when config does not exist", async () => {
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(null) })
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", validBody(), user(), appConfig, store)).rejects.toMatchObject({ status: 404 })
	})

	it("throws 403 when user is not authorized to update", async () => {
		const store = makeStore()
		const nonOwner = user({ userId: "other-user" })
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", validBody(), nonOwner, appConfig, store)).rejects.toMatchObject({ status: 403 })
	})

	it("allows owner to replace their config", async () => {
		const store = makeStore()
		const result = await replaceChatConfig("507f1f77bcf86cd799439011", validBody(), user({ userId: "user-1" }), appConfig, store)
		expect(store.replaceChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("507f1f77bcf86cd799439011")
	})

	it("allows admin to replace any config", async () => {
		const store = makeStore()
		const admin = user({ userId: "admin-1", roles: ["Admin"] })
		const result = await replaceChatConfig("507f1f77bcf86cd799439011", validBody(), admin, appConfig, store)
		expect(store.replaceChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("507f1f77bcf86cd799439011")
	})

	it("preserves existing created field and stamps updated server-side", async () => {
		const store = makeStore()
		await replaceChatConfig("507f1f77bcf86cd799439011", validBody(), user({ userId: "user-1" }), appConfig, store)
		const call = vi.mocked(store.replaceChatConfig).mock.calls[0]?.[1]
		expect(call?.created).toEqual(existingConfig().created)
		expect(call?.updated.by.id).toBe("user-1")
		expect(call?.updated.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
	})

	it("allows maintainer to replace a published config", async () => {
		const publishedConfig: ChatConfig = { ...existingConfig(), type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "other-owner", name: "Other Owner" } } }
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(publishedConfig) })
		const body = { ...(validBody() as Record<string, unknown>), type: "published" }
		const maintainer = user({ userId: "maintainer-1", roles: ["AgentMaintainer"] })
		const result = await replaceChatConfig("507f1f77bcf86cd799439011", body, maintainer, appConfig, store)
		expect(store.replaceChatConfig).toHaveBeenCalled()
		expect(result._id).toBe("507f1f77bcf86cd799439011")
	})

	it("throws 400 for invalid body", async () => {
		await expect(replaceChatConfig("507f1f77bcf86cd799439011", { bad: "body" }, user(), appConfig, makeStore())).rejects.toMatchObject({ status: 400 })
	})
})

describe("deleteChatConfig", () => {
	it("throws 404 when config does not exist", async () => {
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(null) })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", user(), appConfig, store)).rejects.toMatchObject({ status: 404 })
	})

	it("throws 403 when user is not owner or admin", async () => {
		const store = makeStore()
		const nonOwner = user({ userId: "other-user" })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", nonOwner, appConfig, store)).rejects.toMatchObject({ status: 403 })
	})

	it("allows owner to delete their config", async () => {
		const store = makeStore()
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", user({ userId: "user-1" }), appConfig, store)).resolves.toBeUndefined()
		expect(store.deleteChatConfig).toHaveBeenCalledWith("507f1f77bcf86cd799439011")
	})

	it("allows admin to delete any config", async () => {
		const store = makeStore()
		const admin = user({ roles: ["Admin"] })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", admin, appConfig, store)).resolves.toBeUndefined()
	})

	it("allows maintainer to delete a published config", async () => {
		const publishedConfig: ChatConfig = { ...existingConfig(), type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "other-owner", name: "Other Owner" } } }
		const store = makeStore({ getChatConfig: vi.fn().mockResolvedValue(publishedConfig) })
		const maintainer = user({ roles: ["AgentMaintainer"] })
		await expect(deleteChatConfig("507f1f77bcf86cd799439011", maintainer, appConfig, store)).resolves.toBeUndefined()
		expect(store.deleteChatConfig).toHaveBeenCalledWith("507f1f77bcf86cd799439011")
	})
})
