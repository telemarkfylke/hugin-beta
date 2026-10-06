import { describe, expect, it } from "vitest"
import {
	defaultProfileSelection,
	getModelDisplayName,
	getPinnableModels,
	getPinnedModelLabel,
	getProfileBadges,
	getSelectableProfiles,
	pinnedSelection,
	profileSelection,
	supportsWebSearch
} from "$lib/model-profiles"
import type { AppConfig } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"
import type { ClientModelProfile } from "$lib/types/model-profiles"

const profile = (id: string, extra: Partial<ClientModelProfile> = {}): ClientModelProfile => ({
	id,
	label: id.toUpperCase(),
	icon: "*",
	description: "",
	vendorId: "OPENAI",
	model: "gpt-live",
	project: "DEFAULT",
	capabilities: [],
	mimeTypes: { FILE: [], IMAGE: [] },
	...extra
})

const noMime = { FILE: [], IMAGE: [] }
const APP_ROLES = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }
const APP_CONFIG = {
	APP_ROLES,
	MODEL_PROFILES: [profile("rask"), profile("lokal", { roles: ["employee"], vendorId: "LITELLM", model: "normistral" })],
	DEFAULT_PROFILE_IDS: { CHAT: "rask", ASSISTANT: "lokal" },
	VENDORS: {
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: true,
			PROJECTS: ["DEFAULT", "STUDENTS"],
			MODELS: [
				{ KEY: "gpt-live", ID: "gpt-live", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: ["webSearch"], RETIRED: false },
				{ KEY: "gpt-old", ID: "gpt-old", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: ["webSearch"], RETIRED: true }
			]
		},
		MISTRAL: {
			NAME: "Mistral",
			ENABLED: false,
			PROJECTS: ["DEFAULT"],
			MODELS: [{ KEY: "large", ID: "mistral-large-latest", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: [], RETIRED: false }]
		},
		OLLAMA: { NAME: "Ollama", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] },
		LITELLM: { NAME: "TFK", ENABLED: true, PROJECTS: ["DEFAULT"], MODELS: [{ KEY: "normistral", ID: "normistral", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: [], RETIRED: false }] }
	}
} as unknown as AppConfig

const user = (roles: string[]): AuthenticatedPrincipal => ({ userId: "u1", name: "U", preferredUserName: "u", roles, groups: [] })
const chatConfig = (overrides: Partial<ChatConfig>): ChatConfig =>
	({
		_id: "",
		name: "",
		description: "",
		vendorId: "OPENAI",
		project: "DEFAULT",
		type: "private",
		accessGroups: ["all"],
		created: { at: "", by: { id: "" } },
		updated: { at: "", by: { id: "" } },
		...overrides
	}) as ChatConfig

describe("getProfileBadges", () => {
	it("derives badges from mime types, capabilities and data location", () => {
		const badges = getProfileBadges(profile("x", { mimeTypes: { FILE: ["application/pdf"], IMAGE: ["image/png"] }, capabilities: ["webSearch"], dataLocation: "EU" }))
		expect(badges.map((b) => b.label)).toEqual(["Filer", "Bilder", "Nettsøk", "EU"])
		expect(badges.at(-1)?.kind).toBe("location")
	})

	it("returns no badges for a text-only profile", () => {
		expect(getProfileBadges(profile("x"))).toEqual([])
	})
})

describe("getSelectableProfiles", () => {
	it("hides role-restricted profiles from users outside the roles", () => {
		expect(getSelectableProfiles(APP_CONFIG.MODEL_PROFILES, user(["Student"]), APP_ROLES, undefined).map((p) => p.id)).toEqual(["rask"])
	})

	it("shows them to users in the roles and to admins", () => {
		expect(getSelectableProfiles(APP_CONFIG.MODEL_PROFILES, user(["Employee"]), APP_ROLES, undefined)).toHaveLength(2)
		expect(getSelectableProfiles(APP_CONFIG.MODEL_PROFILES, user(["Admin"]), APP_ROLES, undefined)).toHaveLength(2)
	})

	it("keeps the config's current profile visible even when the user couldn't choose it", () => {
		expect(getSelectableProfiles(APP_CONFIG.MODEL_PROFILES, user(["Student"]), APP_ROLES, "lokal").map((p) => p.id)).toEqual(["rask", "lokal"])
	})

	it("hides a profile with an empty roles list from everyone, admins included, unless it's the current one", () => {
		const profiles = [profile("rask"), profile("lokal", { roles: [] })]
		expect(getSelectableProfiles(profiles, user(["Admin"]), APP_ROLES, undefined).map((p) => p.id)).toEqual(["rask"])
		expect(getSelectableProfiles(profiles, user(["Admin"]), APP_ROLES, "lokal").map((p) => p.id)).toEqual(["rask", "lokal"])
	})
})

describe("selections", () => {
	it("profileSelection carries the profile's resolved vendor/model/project", () => {
		expect(profileSelection(profile("lokal", { vendorId: "LITELLM", model: "normistral" }))).toEqual({ profile: "lokal", vendorId: "LITELLM", model: "normistral", project: "DEFAULT" })
	})

	it("defaultProfileSelection uses DEFAULT_PROFILE_IDS", () => {
		expect(defaultProfileSelection(APP_CONFIG, "ASSISTANT")).toMatchObject({ profile: "lokal", vendorId: "LITELLM" })
	})

	it("pinnedSelection maps a catalogue key to vendor + provider model", () => {
		expect(pinnedSelection(APP_CONFIG, "gpt-live", "STUDENTS")).toEqual({ vendorId: "OPENAI", model: "gpt-live", project: "STUDENTS", pinned: { model: "gpt-live", project: "STUDENTS" } })
		expect(pinnedSelection(APP_CONFIG, "nope", "DEFAULT")).toBeNull()
	})

	it("pinnedSelection falls back to the DEFAULT project when the new model's vendor lacks the current one", () => {
		expect(pinnedSelection(APP_CONFIG, "normistral", "STUDENTS")).toEqual({ vendorId: "LITELLM", model: "normistral", project: "DEFAULT", pinned: { model: "normistral", project: "DEFAULT" } })
	})

	it("getPinnableModels lists enabled vendors' non-retired models", () => {
		expect(getPinnableModels(APP_CONFIG).map((g) => [g.vendorId, g.models.map((m) => m.KEY)])).toEqual([
			["OPENAI", ["gpt-live"]],
			["LITELLM", ["normistral"]]
		])
	})
})

describe("supportsWebSearch", () => {
	it("follows the resolved model's capability", () => {
		expect(supportsWebSearch(chatConfig({ vendorId: "OPENAI", model: "gpt-live" }), APP_CONFIG)).toBe(true)
		expect(supportsWebSearch(chatConfig({ vendorId: "LITELLM", model: "normistral" }), APP_CONFIG)).toBe(false)
	})

	// Vendor agents have no model - they must keep the vendor-level rule they had before capabilities
	it("keeps web search for OpenAI/Mistral vendor-agent configs", () => {
		expect(supportsWebSearch(chatConfig({ vendorId: "MISTRAL", vendorAgent: { id: "agent-1" } }), APP_CONFIG)).toBe(true)
		expect(supportsWebSearch(chatConfig({ vendorId: "LITELLM", vendorAgent: { id: "agent-1" } }), APP_CONFIG)).toBe(false)
	})
})

describe("getModelDisplayName", () => {
	it("shows a working pin instead of the profile, so the label never misstates the vendor", () => {
		expect(getModelDisplayName({ profile: "rask", model: "gpt-live", pinned: { model: "normistral", project: "DEFAULT" } }, APP_CONFIG)).toBe("📌 normistral")
		expect(getModelDisplayName({ profile: "rask", model: "gpt-live", pinned: { model: "gpt-old", project: "DEFAULT" } }, APP_CONFIG)).toBe("* RASK")
	})

	it("shows the profile icon + label", () => {
		expect(getModelDisplayName({ profile: "rask", model: "gpt-live" }, APP_CONFIG)).toBe("* RASK")
	})

	it("falls back to the raw model when the profile is unknown", () => {
		expect(getModelDisplayName({ profile: "gone", model: "gpt-live" }, APP_CONFIG)).toBe("gpt-live")
		expect(getModelDisplayName({}, APP_CONFIG)).toBe("")
	})
})

describe("getPinnedModelLabel", () => {
	it("shows the pinned catalogue model's provider ID", () => {
		expect(getPinnedModelLabel({ model: "gpt-live", project: "DEFAULT" }, APP_CONFIG)).toBe("gpt-live")
	})

	it("flags a pin that is retired, on a disabled vendor or missing from the catalogue", () => {
		expect(getPinnedModelLabel({ model: "gpt-old", project: "DEFAULT" }, APP_CONFIG)).toBe("gpt-old (ikke tilgjengelig – følger profilen)")
		expect(getPinnedModelLabel({ model: "large", project: "DEFAULT" }, APP_CONFIG)).toBe("mistral-large-latest (ikke tilgjengelig – følger profilen)")
		expect(getPinnedModelLabel({ model: "gone", project: "DEFAULT" }, APP_CONFIG)).toBe("gone (ikke tilgjengelig – følger profilen)")
	})
})
