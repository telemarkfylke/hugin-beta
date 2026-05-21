import { describe, expect, it } from "vitest"
import { parseBodySizeLimitBytes } from "$lib/server/app-config/app-config"

describe("parseBodySizeLimitBytes", () => {
	it("uses default when value is missing", () => {
		expect(parseBodySizeLimitBytes(undefined, 123)).toBe(123)
	})

	it("parses plain byte values", () => {
		expect(parseBodySizeLimitBytes("536870912", 123)).toBe(536870912)
	})

	it("parses megabyte values", () => {
		expect(parseBodySizeLimitBytes("512M", 123)).toBe(512 * 1024 * 1024)
		expect(parseBodySizeLimitBytes("512MB", 123)).toBe(512 * 1024 * 1024)
	})

	it("falls back to default for invalid values", () => {
		expect(parseBodySizeLimitBytes("wat", 123)).toBe(123)
		expect(parseBodySizeLimitBytes("-1", 123)).toBe(123)
	})
})
