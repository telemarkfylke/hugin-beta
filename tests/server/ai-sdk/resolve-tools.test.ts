import { describe, expect, it } from "vitest"
import { resolveTools } from "../../../src/lib/server/ai-sdk/resolve-tools"
import type { ChatTool } from "../../../src/lib/types/chat"

describe("resolveTools", () => {
	it("returns undefined when tools is an empty array", () => {
		const result = resolveTools([], "OPENAI")
		expect(result).toBeUndefined()
	})

	it("returns undefined when tools is null or undefined", () => {
		expect(resolveTools(null, "OPENAI")).toBeUndefined()
		expect(resolveTools(undefined, "OPENAI")).toBeUndefined()
	})

	it("returns a tool object with webSearch property for OPENAI web_search", () => {
		const tools: ChatTool[] = [{ type: "web_search" }]
		const result = resolveTools(tools, "OPENAI")
		expect(result).toBeDefined()
		expect(result).toHaveProperty("webSearch")
		expect(typeof result?.webSearch).toBe("object")
	})

	it("returns a tool object with webSearch property for MISTRAL web_search", () => {
		const tools: ChatTool[] = [{ type: "web_search" }]
		const result = resolveTools(tools, "MISTRAL")
		expect(result).toBeDefined()
		expect(result).toHaveProperty("webSearch")
		expect(typeof result?.webSearch).toBe("object")
	})
})
