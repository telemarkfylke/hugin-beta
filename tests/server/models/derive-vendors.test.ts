import { describe, expect, it } from "vitest"
import {
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
} from "$lib/server/app-config/supported-mime-types"
import { deriveVendorModels, resolveFilePreset } from "$lib/server/models/derive-vendors"
import { MODEL_CONFIG } from "$lib/server/models/models.config"

const OPENAI_MIME = { FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES, IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES }
const MISTRAL_MIME = { FILE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES, IMAGE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES }
const NO_MIME = { FILE: [], IMAGE: [] }

describe("deriveVendorModels on the real catalogue", () => {
	it("keeps every OpenAI model ID and mime type that app-config.ts had before profiles", () => {
		const models = deriveVendorModels(MODEL_CONFIG, "OPENAI")
		expect(models.map((m) => m.ID)).toEqual(["gpt-4o", "gpt-4", "gpt-4.1", "gpt-5.2", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-6-sol", "gpt-5.6-luna"])
		for (const model of models) {
			expect(model.SUPPORTED_MESSAGE_FILE_MIME_TYPES).toEqual(OPENAI_MIME)
		}
	})

	// The Responses API reads Office, text and code files as input_file, not just PDF - keep parity with Mistral
	it("lets OpenAI models accept the same document types as Mistral", () => {
		const terra = deriveVendorModels(MODEL_CONFIG, "OPENAI").find((m) => m.ID === "gpt-5.6-terra")
		expect(terra?.SUPPORTED_MESSAGE_FILE_MIME_TYPES.FILE).toEqual(expect.arrayContaining(MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES))
	})

	it("keeps every Mistral model ID and mime type", () => {
		const models = deriveVendorModels(MODEL_CONFIG, "MISTRAL")
		expect(models.map((m) => m.ID)).toEqual(["mistral-medium-latest", "mistral-large-latest"])
		for (const model of models) {
			expect(model.SUPPORTED_MESSAGE_FILE_MIME_TYPES).toEqual(MISTRAL_MIME)
		}
	})

	it("keeps Ollama and LiteLLM model IDs with no file support", () => {
		expect(deriveVendorModels(MODEL_CONFIG, "OLLAMA").map((m) => [m.ID, m.SUPPORTED_MESSAGE_FILE_MIME_TYPES])).toEqual([
			["llama3:8b", NO_MIME],
			["LTG/normistral-11b-thinking:latest", NO_MIME]
		])
		expect(deriveVendorModels(MODEL_CONFIG, "LITELLM").map((m) => m.ID)).toEqual(["norallm/normistral-11b-thinking"])
	})

	it("leaves internal models (utility LLM) out", () => {
		expect(deriveVendorModels(MODEL_CONFIG, "LITELLM").some((m) => m.KEY === "llama3-utility")).toBe(false)
	})

	// Old conversations on a retired model must still find their mime types client-side
	it("includes retired models, flagged", () => {
		const gpt4o = deriveVendorModels(MODEL_CONFIG, "OPENAI").find((m) => m.ID === "gpt-4o")
		expect(gpt4o).toMatchObject({ KEY: "gpt-4o", RETIRED: true, SUPPORTED_MESSAGE_FILE_MIME_TYPES: OPENAI_MIME })
		const terra = deriveVendorModels(MODEL_CONFIG, "OPENAI").find((m) => m.ID === "gpt-5.6-terra")
		expect(terra).toMatchObject({ KEY: "gpt-5.6-terra", RETIRED: false, CAPABILITIES: ["webSearch"] })
	})
})

describe("resolveFilePreset", () => {
	it("passes an explicit mime object through", () => {
		expect(resolveFilePreset({ FILE: ["text/plain"], IMAGE: [] })).toEqual({ FILE: ["text/plain"], IMAGE: [] })
	})

	it("returns empty lists for none", () => {
		expect(resolveFilePreset("none")).toEqual(NO_MIME)
	})
})
