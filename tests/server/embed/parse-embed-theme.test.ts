import { describe, expect, it } from "vitest"
import { parseEmbedThemeParams } from "../../../src/lib/embed/parse-embed-theme"

describe("parseEmbedThemeParams", () => {
	it("defaults to auto theme, no accent, no title, not compact when nothing is set", () => {
		const result = parseEmbedThemeParams(new URLSearchParams())
		expect(result).toEqual({ theme: "auto", accent: undefined, title: undefined, compact: false })
	})

	it("accepts light and dark theme values", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("theme=light")).theme).toBe("light")
		expect(parseEmbedThemeParams(new URLSearchParams("theme=dark")).theme).toBe("dark")
	})

	it("falls back to auto for an unknown theme value", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("theme=solarized")).theme).toBe("auto")
	})

	it("accepts a valid 6-digit hex accent and lowercases it", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("accent=A6760E")).accent).toBe("a6760e")
	})

	it("rejects a 3-digit hex accent", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("accent=fff")).accent).toBeUndefined()
	})

	it("rejects an accent value that isn't hex at all", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("accent=" + encodeURIComponent("red;}body{display:none"))).accent).toBeUndefined()
	})

	it("trims and caps title length, and drops a blank title", () => {
		expect(parseEmbedThemeParams(new URLSearchParams("title=" + encodeURIComponent("  Økonomihjelperen  "))).title).toBe("Økonomihjelperen")
		expect(parseEmbedThemeParams(new URLSearchParams("title=" + encodeURIComponent("   "))).title).toBeUndefined()
		const longTitle = "x".repeat(200)
		expect(parseEmbedThemeParams(new URLSearchParams({ title: longTitle })).title).toBe("x".repeat(100))
	})

	it('only treats the literal value "1" as compact', () => {
		expect(parseEmbedThemeParams(new URLSearchParams("compact=1")).compact).toBe(true)
		expect(parseEmbedThemeParams(new URLSearchParams("compact=true")).compact).toBe(false)
		expect(parseEmbedThemeParams(new URLSearchParams("compact=0")).compact).toBe(false)
	})

	it("ignores unknown params entirely", () => {
		const result = parseEmbedThemeParams(new URLSearchParams("foo=bar&theme=dark"))
		expect(result.theme).toBe("dark")
	})
})
