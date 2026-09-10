import { describe, expect, it } from "vitest"
import { McpSourceInputSchema } from "../../../src/lib/types/mcp-source"

describe("McpSourceInputSchema", () => {
	it("accepts a source with folders and search disabled", () => {
		const result = McpSourceInputSchema.parse({
			server: "sharepoint",
			name: "Budsjett",
			type: "private",
			folders: [{ value: "Budsjett", matchType: "prefix" }],
			searchEnabled: false
		})
		expect(result.name).toBe("Budsjett")
	})

	it("accepts a source with no folders as long as search is enabled", () => {
		const result = McpSourceInputSchema.parse({
			server: "sharepoint",
			name: "Bare søk",
			type: "private",
			folders: [],
			searchEnabled: true
		})
		expect(result.folders).toEqual([])
	})

	it("rejects a source with no folders and search disabled - it would grant no access at all", () => {
		expect(() =>
			McpSourceInputSchema.parse({
				server: "sharepoint",
				name: "Ingenting",
				type: "private",
				folders: [],
				searchEnabled: false
			})
		).toThrow()
	})

	it("rejects an unknown server value", () => {
		expect(() =>
			McpSourceInputSchema.parse({
				server: "something-else",
				name: "x",
				type: "private",
				folders: [{ value: "a", matchType: "exact" }],
				searchEnabled: false
			})
		).toThrow()
	})

	it("rejects an unknown type value", () => {
		expect(() =>
			McpSourceInputSchema.parse({
				server: "sharepoint",
				name: "x",
				type: "public",
				folders: [{ value: "a", matchType: "exact" }],
				searchEnabled: false
			})
		).toThrow()
	})

	it("accepts a published source", () => {
		const result = McpSourceInputSchema.parse({
			server: "sharepoint",
			name: "Delt kilde",
			type: "published",
			folders: [{ value: "Budsjett", matchType: "prefix" }],
			searchEnabled: false
		})
		expect(result.type).toBe("published")
	})
})
