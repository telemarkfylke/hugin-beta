import { logger } from "@vestfoldfylke/loglady"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deriveVendorModels } from "$lib/server/models/derive-vendors"
import { buildClientProfiles, type ModelContext, resolveChatConfig } from "$lib/server/models/resolve"
import type { ModelConfig } from "$lib/server/models/types"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"
import { parseChatConfig } from "$lib/validation/parse-chat-config"

// Save-mode validation followed by the store's resolution, on one consistent fixture: the AppConfig
// the validator sees is derived from the same ModelConfig resolution uses. Guards against a body that
// passes validation but resolves to a profile the user may not choose.
const MODEL_CONFIG: ModelConfig = {
	MODELS: {
		luna: { vendor: "OPENAI", providerModel: "gpt-luna", files: "openai", capabilities: [] },
		normistral: { vendor: "LITELLM", providerModel: "norallm/normistral-11b-thinking", files: "none", capabilities: [] }
	},
	PROFILES: [
		{ id: "rask", label: "Rask", icon: "bolt", description: "Raske svar", model: "luna" },
		{ id: "lokal", label: "Lokal", icon: "home", description: "Lokalt", model: "normistral", dataLocation: "Egne servere", roles: ["employee"] }
	],
	DEFAULTS: { chat: "rask", assistant: "rask", canvas: "rask", utility: "luna" },
	LEGACY: {}
}

const ctx: ModelContext = { modelConfig: MODEL_CONFIG, isVendorEnabled: () => true }

const vendor = (name: string, vendorId: "OPENAI" | "LITELLM") => ({ NAME: name, ENABLED: true, PROJECTS: ["DEFAULT"], MODELS: deriveVendorModels(MODEL_CONFIG, vendorId) })

const APP_CONFIG = {
	APP_ROLES: { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" },
	MODEL_PROFILES: buildClientProfiles(ctx),
	VENDORS: { OPENAI: vendor("OpenAI", "OPENAI"), LITELLM: vendor("LiteLLM", "LITELLM") }
} as unknown as AppConfig

const student: AuthenticatedPrincipal = { userId: "s1", name: "S", preferredUserName: "s", roles: ["Student"], groups: [] }

const base = {
	_id: "1",
	name: "n",
	description: "d",
	project: "DEFAULT",
	type: "private",
	accessGroups: ["all"],
	created: { at: "now", by: { id: "s1" } },
	updated: { at: "now", by: { id: "s1" } }
}

// What the store would persist, or null when validation rejected the body
const saveThenResolve = (body: unknown, previous: ChatConfig | null): ChatConfig | null => {
	let parsed: ChatConfig
	try {
		parsed = parseChatConfig(body, APP_CONFIG, { mode: "save", user: student, previous })
	} catch {
		return null
	}
	return resolveChatConfig(parsed, ctx)
}

describe("save-mode validation followed by resolution", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		warnSpy.mockRestore()
	})

	const previousRask = { ...base, vendorId: "OPENAI", model: "gpt-luna", profile: "rask" } as ChatConfig

	it.each([
		["a legacy profile-less body naming the lokal model", { ...base, vendorId: "LITELLM", model: "norallm/normistral-11b-thinking" }, null],
		["a body choosing the lokal profile", { ...base, vendorId: "LITELLM", model: "norallm/normistral-11b-thinking", profile: "lokal" }, null],
		["an update dropping the profile and naming the lokal model", { ...base, vendorId: "LITELLM", model: "norallm/normistral-11b-thinking" }, previousRask]
	])("a student cannot end up with profile lokal via %s", (_label, body, previous) => {
		expect(saveThenResolve(body, previous)?.profile).not.toBe("lokal")
	})

	it("still lets a student save a profile they may choose", () => {
		expect(saveThenResolve({ ...base, vendorId: "OPENAI", model: "gpt-luna", profile: "rask" }, null)).toMatchObject({ profile: "rask", vendorId: "OPENAI", model: "gpt-luna" })
	})
})
