import { afterEach, describe, expect, it, vi } from "vitest"
import { flattenToolResult } from "../../../src/lib/server/mcp/mcp-client"

afterEach(() => vi.restoreAllMocks())

describe("flattenToolResult", () => {
	it("concatenates text content parts", () => {
		expect(
			flattenToolResult({
				content: [
					{ type: "text", text: "a" },
					{ type: "text", text: "b" }
				]
			})
		).toBe("ab")
	})

	it("ignores non-text parts", () => {
		expect(
			flattenToolResult({
				content: [
					{ type: "image", data: "x" },
					{ type: "text", text: "only" }
				]
			})
		).toBe("only")
	})

	it("returns empty string when no content", () => {
		expect(flattenToolResult({})).toBe("")
	})
})
