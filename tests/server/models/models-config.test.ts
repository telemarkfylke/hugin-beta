import { describe, expect, it } from "vitest"
import { assertModelConfig } from "$lib/server/models/assert-model-config"
import { MODEL_CONFIG } from "$lib/server/models/models.config"
import type { ModelConfig } from "$lib/server/models/types"

const validConfig = (): ModelConfig => ({
	MODELS: {
		luna: { vendor: "OPENAI", providerModel: "gpt-luna", files: "openai", capabilities: ["webSearch"] },
		old: { vendor: "OPENAI", providerModel: "gpt-old", files: "openai", capabilities: [], status: "retired" },
		util: { vendor: "LITELLM", providerModel: "llama-util", files: "none", capabilities: [], internal: true }
	},
	PROFILES: [{ id: "rask", label: "Rask", icon: "bolt", description: "d", model: "luna" }],
	DEFAULTS: { chat: "rask", assistant: "rask", canvas: "rask", utility: "util" },
	LEGACY: { "gpt-old": "rask" }
})

describe("assertModelConfig", () => {
	it("accepts the real models.config.ts", () => {
		expect(() => assertModelConfig(MODEL_CONFIG)).not.toThrow()
	})

	it("accepts a valid fixture", () => {
		expect(() => assertModelConfig(validConfig())).not.toThrow()
	})

	it("rejects a profile pointing to an unknown model", () => {
		const config = validConfig()
		config.PROFILES = [{ id: "rask", label: "Rask", icon: "", description: "", model: "nope" }]
		expect(() => assertModelConfig(config)).toThrow(/unknown model "nope"/)
	})

	it("rejects a profile pointing to a retired model", () => {
		const config = validConfig()
		config.PROFILES = [{ id: "rask", label: "Rask", icon: "", description: "", model: "old" }]
		expect(() => assertModelConfig(config)).toThrow(/retired model "old"/)
	})

	it("rejects a profile pointing to an internal model", () => {
		const config = validConfig()
		config.PROFILES = [{ id: "rask", label: "Rask", icon: "", description: "", model: "util" }]
		expect(() => assertModelConfig(config)).toThrow(/internal model "util"/)
	})

	it("rejects duplicate profile ids", () => {
		const config = validConfig()
		config.PROFILES = [...config.PROFILES, { id: "rask", label: "Rask 2", icon: "", description: "", model: "luna" }]
		expect(() => assertModelConfig(config)).toThrow(/Duplicate profile id "rask"/)
	})

	it("rejects a default that is not a profile id", () => {
		const config = validConfig()
		config.DEFAULTS = { ...config.DEFAULTS, canvas: "grundig" }
		expect(() => assertModelConfig(config)).toThrow(/DEFAULTS.canvas "grundig"/)
	})

	it("rejects a utility default that is not an internal model", () => {
		const config = validConfig()
		config.DEFAULTS = { ...config.DEFAULTS, utility: "luna" }
		expect(() => assertModelConfig(config)).toThrow(/DEFAULTS.utility "luna" must point to an internal model/)
	})

	it("rejects a LEGACY entry pointing to an unknown profile", () => {
		const config = validConfig()
		config.LEGACY = { "gpt-old": "grundig" }
		expect(() => assertModelConfig(config)).toThrow(/LEGACY\["gpt-old"\] points to unknown profile "grundig"/)
	})

	it("reports every problem at once", () => {
		const config = validConfig()
		config.DEFAULTS = { chat: "x", assistant: "y", canvas: "rask", utility: "util" }
		expect(() => assertModelConfig(config)).toThrow(/DEFAULTS.chat[\s\S]*DEFAULTS.assistant/)
	})
})

describe("real models.config.ts", () => {
	// Assistants may still be stored on local-server models from earlier app-config.ts versions - they must stay on "lokal", never migrate to a cloud default
	it("maps every historical local model ID to lokal", () => {
		for (const id of ["gemma:2b", "LTG/normistral-11b-thinking", "LTG/normistral-11b-thinking:latest", "llama3", "llama3:8b"]) {
			expect(MODEL_CONFIG.LEGACY[id]).toBe("lokal")
		}
	})

	// Every model an existing assistant could have stored must map to a profile without hitting the
	// "fell back to default" path - either via LEGACY or because a profile uses it directly.
	it("maps every non-internal model's provider ID to a profile", () => {
		const profileModelIds = new Set(MODEL_CONFIG.PROFILES.map((profile) => MODEL_CONFIG.MODELS[profile.model]?.providerModel))
		const unmapped = Object.values(MODEL_CONFIG.MODELS)
			.filter((model) => !model.internal)
			.map((model) => model.providerModel)
			.filter((providerModel) => !MODEL_CONFIG.LEGACY[providerModel] && !profileModelIds.has(providerModel))
		expect(unmapped).toEqual([])
	})
})
