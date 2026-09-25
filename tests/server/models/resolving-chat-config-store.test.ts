import { describe, expect, it } from "vitest"
import type { ModelSelection } from "$lib/server/models/resolve"
import { ResolvingChatConfigStore } from "$lib/server/models/resolving-chat-config-store"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig, NewChatConfig } from "$lib/types/chat"
import type { IChatConfigStore } from "$lib/types/db/db-interface"

const storedConfig: ChatConfig = {
	_id: "cfg-1",
	name: "n",
	description: "d",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4o",
	type: "private",
	accessGroups: ["all"],
	created: { at: "now", by: { id: "u1" } },
	updated: { at: "now", by: { id: "u1" } }
}

const fakeResolve = <T extends ModelSelection>(config: T): T => ({ ...config, profile: "rask", model: "resolved-model" })

const makeInner = () => {
	const written: NewChatConfig[] = []
	const inner: IChatConfigStore = {
		getChatConfig: async (id) => (id === "cfg-1" ? storedConfig : null),
		getChatConfigs: async () => [storedConfig],
		createChatConfig: async (config) => {
			written.push(config)
			return { ...config, _id: "new-id" }
		},
		replaceChatConfig: async (id, config) => {
			written.push(config)
			return { ...config, _id: id }
		},
		deleteChatConfig: async () => {}
	}
	return { inner, written }
}

const principal: AuthenticatedPrincipal = { userId: "u1", name: "U", preferredUserName: "u", roles: [], groups: [] }

describe("ResolvingChatConfigStore", () => {
	it("resolves a single config on read", async () => {
		const { inner } = makeInner()
		const store = new ResolvingChatConfigStore(inner, fakeResolve)
		expect(await store.getChatConfig("cfg-1")).toMatchObject({ profile: "rask", model: "resolved-model" })
	})

	it("passes null through for a missing config", async () => {
		const { inner } = makeInner()
		expect(await new ResolvingChatConfigStore(inner, fakeResolve).getChatConfig("missing")).toBeNull()
	})

	it("resolves every config in a list", async () => {
		const { inner } = makeInner()
		const configs = await new ResolvingChatConfigStore(inner, fakeResolve).getChatConfigs(principal)
		expect(configs.map((c) => c.model)).toEqual(["resolved-model"])
	})

	it("writes resolved configs on create and replace", async () => {
		const { inner, written } = makeInner()
		const store = new ResolvingChatConfigStore(inner, fakeResolve)
		const { _id, ...newConfig } = storedConfig
		await store.createChatConfig(newConfig)
		await store.replaceChatConfig("cfg-1", newConfig)
		expect(written.map((c) => c.profile)).toEqual(["rask", "rask"])
	})
})
