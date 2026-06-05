import { describe, expect, it, vi } from "vitest"
import type { ChatTool } from "../../../src/lib/types/chat"

vi.mock("$env/dynamic/private", () => ({
	env: {
		OPENAI_API_KEY_PROJECT_DEFAULT: "test-openai-key"
	}
}))

describe("resolveTools", () => {
	it("returns undefined when tools is an empty array", async () => {
		const { resolveTools } = await import("../../../src/lib/server/ai-sdk/resolve-tools")
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		const result = resolveTools([], { vendorId: "OPENAI", project: "DEFAULT" } as any)
		expect(result).toBeUndefined()
	})

	it("returns undefined when tools is null or undefined", async () => {
		const { resolveTools } = await import("../../../src/lib/server/ai-sdk/resolve-tools")
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		expect(resolveTools(null, { vendorId: "OPENAI", project: "DEFAULT" } as any)).toBeUndefined()
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		expect(resolveTools(undefined, { vendorId: "OPENAI", project: "DEFAULT" } as any)).toBeUndefined()
	})

	it("returns a tool object with webSearch property for OPENAI web_search", async () => {
		const { resolveTools } = await import("../../../src/lib/server/ai-sdk/resolve-tools")
		const tools: ChatTool[] = [{ type: "web_search" }]
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		const result = resolveTools(tools, { vendorId: "OPENAI", project: "DEFAULT" } as any)
		expect(result).toBeDefined()
		expect(result).toHaveProperty("webSearch")
		expect(typeof result?.webSearch).toBe("object")
	})

	it("returns a tool object with webSearch property for MISTRAL web_search (uses OpenAI web search)", async () => {
		const { resolveTools } = await import("../../../src/lib/server/ai-sdk/resolve-tools")
		const tools: ChatTool[] = [{ type: "web_search" }]
		// biome-ignore lint/suspicious/noExplicitAny: test uses partial ChatConfig
		const result = resolveTools(tools, { vendorId: "MISTRAL", project: "DEFAULT" } as any)
		expect(result).toBeDefined()
		expect(result).toHaveProperty("webSearch")
		expect(typeof result?.webSearch).toBe("object")
	})
})
