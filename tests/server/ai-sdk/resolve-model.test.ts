import { describe, expect, it, vi } from "vitest"

vi.mock("$env/dynamic/private", () => ({
	env: {
		OPENAI_API_KEY_PROJECT_DEFAULT: "test-openai-key",
		OPENAI_API_KEY_PROJECT_SCHOOL: "test-openai-school-key",
		MISTRAL_API_KEY_PROJECT_DEFAULT: "test-mistral-key"
	}
}))

describe("resolveModel", () => {
	it("returns a model object for OPENAI DEFAULT project", async () => {
		const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		const model = resolveModel({ vendorId: "OPENAI", project: "DEFAULT", model: "gpt-4o" } as any)
		expect(model).toBeDefined()
		expect(typeof model).toBe("object")
	})

	it("returns a model object for MISTRAL DEFAULT project", async () => {
		const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		const model = resolveModel({ vendorId: "MISTRAL", project: "DEFAULT", model: "mistral-large-latest" } as any)
		expect(model).toBeDefined()
		expect(typeof model).toBe("object")
	})

	it("throws HTTPError 400 for unsupported vendorId", async () => {
		const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
		const { HTTPError } = await import("../../../src/lib/server/middleware/http-error")
		// biome-ignore lint/suspicious/noExplicitAny: test exercises invalid vendorId path
		expect(() => resolveModel({ vendorId: "UNKNOWN" as any, project: "DEFAULT", model: "gpt-4o" } as any)).toThrow(HTTPError)
	})

	it("throws HTTPError 500 for missing API key", async () => {
		const { resolveModel } = await import("../../../src/lib/server/ai-sdk/resolve-model")
		const { HTTPError } = await import("../../../src/lib/server/middleware/http-error")
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		expect(() => resolveModel({ vendorId: "OPENAI", project: "NOKEY", model: "gpt-4o" } as any)).toThrow(HTTPError)
	})
})
