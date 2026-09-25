import { logger } from "@vestfoldfylke/loglady"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildClientProfiles, isResolvedModelAvailable, type ModelContext, type ModelSelection, resolveChatConfig, resolveDefaultModel, resolveDefaultProfileId } from "$lib/server/models/resolve"
import type { ModelConfig } from "$lib/server/models/types"
import type { VendorId } from "$lib/types/chat"

const MODEL_CONFIG: ModelConfig = {
	MODELS: {
		luna: { vendor: "OPENAI", providerModel: "gpt-luna", files: "openai", capabilities: ["webSearch"] },
		terra: { vendor: "OPENAI", providerModel: "gpt-terra", files: "openai", capabilities: ["webSearch"] },
		large: { vendor: "MISTRAL", providerModel: "mistral-large-latest", files: "mistral", capabilities: ["webSearch"] },
		old: { vendor: "OPENAI", providerModel: "gpt-old", files: "openai", capabilities: [], status: "retired" },
		util: { vendor: "LITELLM", providerModel: "llama-util", files: "none", capabilities: [], internal: true }
	},
	PROFILES: [
		{ id: "rask", label: "Rask", icon: "⚡", description: "Raske svar", model: "luna" },
		{ id: "grundig", label: "Grundig", icon: "🧠", description: "Analyse", model: "terra" },
		{ id: "europeisk", label: "Europeisk", icon: "🇪🇺", description: "EU", model: "large", dataLocation: "EU", roles: ["employee"] }
	],
	DEFAULTS: { chat: "europeisk", assistant: "rask", canvas: "grundig", utility: "util" },
	LEGACY: { "gpt-old": "rask" }
}

const ctx = (enabled: VendorId[] = ["OPENAI", "MISTRAL", "LITELLM"]): ModelContext => ({
	modelConfig: MODEL_CONFIG,
	isVendorEnabled: (vendorId) => enabled.includes(vendorId)
})

// Unlike ctx() above (enabled.includes(vendorId), which tolerates an undefined vendorId by just
// returning false), this throws on anything but a known vendor key - proving a lookup actually
// resolved to a real (or properly absent) catalogue entry, not an inherited prototype value.
const strictCtx = (enabled: VendorId[] = ["OPENAI", "MISTRAL", "LITELLM"]): ModelContext => {
	const enabledByVendor: Record<string, boolean> = {
		OPENAI: enabled.includes("OPENAI"),
		MISTRAL: enabled.includes("MISTRAL"),
		LITELLM: enabled.includes("LITELLM"),
		OLLAMA: enabled.includes("OLLAMA")
	}
	return {
		modelConfig: MODEL_CONFIG,
		isVendorEnabled: (vendorId) => {
			if (!Object.hasOwn(enabledByVendor, vendorId)) {
				throw new Error(`unknown vendor: ${vendorId}`)
			}
			return enabledByVendor[vendorId] as boolean
		}
	}
}

const config = (overrides: Partial<ModelSelection>): ModelSelection => ({ _id: "cfg-1", vendorId: "MISTRAL", project: "DEFAULT", ...overrides })

describe("resolveChatConfig", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		warnSpy.mockRestore()
	})

	it("fills vendorId/model/project from the profile", () => {
		expect(resolveChatConfig(config({ profile: "grundig" }), ctx())).toMatchObject({ profile: "grundig", vendorId: "OPENAI", model: "gpt-terra", project: "DEFAULT" })
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it("ignores stale vendorId/model/project sent alongside a profile", () => {
		const resolved = resolveChatConfig(config({ profile: "rask", vendorId: "MISTRAL", model: "mistral-large-latest", project: "OTHER" }), ctx())
		expect(resolved).toMatchObject({ vendorId: "OPENAI", model: "gpt-luna", project: "DEFAULT" })
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it("uses a pinned model and project over the profile", () => {
		const resolved = resolveChatConfig(config({ profile: "rask", pinned: { model: "terra", project: "STUDENTS" } }), ctx())
		expect(resolved).toMatchObject({ vendorId: "OPENAI", model: "gpt-terra", project: "STUDENTS", pinned: { model: "terra", project: "STUDENTS" } })
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it("falls back to the profile when the pinned model is retired, keeping the pin", () => {
		const resolved = resolveChatConfig(config({ profile: "grundig", pinned: { model: "old", project: "DEFAULT" } }), ctx())
		expect(resolved).toMatchObject({ model: "gpt-terra", pinned: { model: "old", project: "DEFAULT" } })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("maps a pre-profile config through LEGACY and sets profile", () => {
		expect(resolveChatConfig(config({ vendorId: "OPENAI", model: "gpt-old" }), ctx())).toMatchObject({ profile: "rask", model: "gpt-luna" })
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it("maps a pre-profile config whose model a profile uses directly, without a LEGACY entry", () => {
		expect(resolveChatConfig(config({ vendorId: "OPENAI", model: "gpt-terra" }), ctx())).toMatchObject({ profile: "grundig", model: "gpt-terra" })
		expect(warnSpy).not.toHaveBeenCalled()
	})

	it("falls back to DEFAULTS.assistant for an unknown model", () => {
		expect(resolveChatConfig(config({ vendorId: "OPENAI", model: "gpt-nope" }), ctx())).toMatchObject({ profile: "rask", model: "gpt-luna" })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("falls back to DEFAULTS.assistant for an unknown profile", () => {
		expect(resolveChatConfig(config({ profile: "gone" }), ctx())).toMatchObject({ profile: "rask" })
		expect(warnSpy).toHaveBeenCalled()
	})

	// DEFAULTS.assistant (rask) is on OPENAI too, so this also covers falling through to the first usable profile's model
	it("falls back when a profile without dataLocation has its vendor disabled, keeping the requested profile id", () => {
		expect(resolveChatConfig(config({ profile: "grundig" }), ctx(["MISTRAL"]))).toMatchObject({ profile: "grundig", vendorId: "MISTRAL", model: "mistral-large-latest", project: "DEFAULT" })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("maps a pre-profile config to a profile without dataLocation whose vendor is disabled, keeping that profile id and using the fallback's model", () => {
		expect(resolveChatConfig(config({ vendorId: "OPENAI", model: "gpt-terra" }), ctx(["MISTRAL"]))).toMatchObject({ profile: "grundig", vendorId: "MISTRAL", model: "mistral-large-latest" })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("never substitutes another vendor for a dataLocation profile whose vendor is disabled", () => {
		expect(resolveChatConfig(config({ profile: "europeisk", vendorId: "OPENAI", model: "gpt-luna" }), ctx(["OPENAI"]))).toMatchObject({
			profile: "europeisk",
			vendorId: "MISTRAL",
			model: "mistral-large-latest",
			project: "DEFAULT"
		})
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("data location"), "cfg-1", "europeisk")
	})

	it("never substitutes another vendor for a pre-profile config that maps to a dataLocation profile", () => {
		expect(resolveChatConfig(config({ vendorId: "MISTRAL", model: "mistral-large-latest" }), ctx(["OPENAI"]))).toMatchObject({
			profile: "europeisk",
			vendorId: "MISTRAL",
			model: "mistral-large-latest",
			project: "DEFAULT"
		})
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("data location"), "cfg-1", "europeisk")
	})

	it("keeps the ordinary fallback for a dataLocation profile whose own model is missing from the catalogue", () => {
		const modelConfig: ModelConfig = { ...MODEL_CONFIG, PROFILES: MODEL_CONFIG.PROFILES.map((p) => (p.id === "europeisk" ? { ...p, model: "gone" } : p)) }
		const resolved = resolveChatConfig(config({ profile: "europeisk" }), { modelConfig, isVendorEnabled: () => true })
		expect(resolved).toMatchObject({ profile: "europeisk", vendorId: "OPENAI", model: "gpt-luna" })
	})

	it("ignores an inherited-property pin key and falls back to the profile instead of crashing", () => {
		const resolved = resolveChatConfig(config({ profile: "rask", pinned: { model: "constructor", project: "DEFAULT" } }), strictCtx())
		expect(resolved).toMatchObject({ profile: "rask", vendorId: "OPENAI", model: "gpt-luna" })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("ignores an inherited-property stored model and falls back to DEFAULTS.assistant instead of crashing", () => {
		const resolved = resolveChatConfig(config({ vendorId: "OPENAI", model: "constructor" }), strictCtx())
		expect(resolved).toMatchObject({ profile: "rask", model: "gpt-luna" })
		expect(warnSpy).toHaveBeenCalled()
	})

	it("returns vendor-agent configs untouched", () => {
		const vendorAgentConfig = config({ vendorAgent: { id: "agent-1" }, profile: "rask" })
		expect(resolveChatConfig(vendorAgentConfig, ctx())).toBe(vendorAgentConfig)
	})

	it("throws when no profile is usable at all", () => {
		expect(() => resolveChatConfig(config({ profile: "rask" }), ctx([]))).toThrow(/No usable model profile/)
	})
})

describe("isResolvedModelAvailable", () => {
	it("is true for a manual config whose vendor is enabled", () => {
		expect(isResolvedModelAvailable(config({ vendorId: "MISTRAL", model: "mistral-large-latest" }), ctx())).toBe(true)
	})

	it("is false for a manual config whose vendor is disabled", () => {
		expect(isResolvedModelAvailable(config({ vendorId: "MISTRAL", model: "mistral-large-latest" }), ctx(["OPENAI"]))).toBe(false)
	})

	it("is true for a vendor-agent config regardless of vendor enablement", () => {
		expect(isResolvedModelAvailable(config({ vendorId: "MISTRAL", vendorAgent: { id: "agent-1" } }), ctx([]))).toBe(true)
	})
})

describe("resolveDefaultModel / resolveDefaultProfileId", () => {
	it("resolves canvas to its profile's model", () => {
		expect(resolveDefaultModel("canvas", ctx())).toEqual({ vendorId: "OPENAI", model: "gpt-terra", project: "DEFAULT" })
	})

	it("returns null for canvas when its vendor is disabled", () => {
		expect(resolveDefaultModel("canvas", ctx(["MISTRAL"]))).toBeNull()
	})

	it("resolves utility to the internal model regardless of vendor enablement", () => {
		expect(resolveDefaultModel("utility", ctx([]))).toEqual({ vendorId: "LITELLM", model: "llama-util", project: "DEFAULT" })
	})

	it("falls back for chat when DEFAULTS.chat's vendor is disabled", () => {
		expect(resolveDefaultProfileId("chat", ctx(["OPENAI"]))).toBe("rask")
		expect(resolveDefaultModel("chat", ctx(["OPENAI"]))).toEqual({ vendorId: "OPENAI", model: "gpt-luna", project: "DEFAULT" })
	})

	it("returns null for chat when nothing is enabled", () => {
		expect(resolveDefaultProfileId("chat", ctx([]))).toBeNull()
	})
})

describe("buildClientProfiles", () => {
	it("includes resolved vendor/model, mime types, capabilities and roles", () => {
		const europeisk = buildClientProfiles(ctx()).find((p) => p.id === "europeisk")
		expect(europeisk).toMatchObject({ vendorId: "MISTRAL", model: "mistral-large-latest", project: "DEFAULT", capabilities: ["webSearch"], dataLocation: "EU", roles: ["employee"] })
		expect(europeisk?.mimeTypes.FILE.length).toBeGreaterThan(0)
	})

	it("hides profiles whose vendor is disabled", () => {
		expect(buildClientProfiles(ctx(["OPENAI"])).map((p) => p.id)).toEqual(["rask", "grundig"])
	})
})
