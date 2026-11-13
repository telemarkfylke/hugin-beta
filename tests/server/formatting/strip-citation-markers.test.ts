import { describe, expect, it } from "vitest"
import { stripCitationMarkers } from "$lib/formatting/strip-citation-markers"

// OpenAI models sometimes leak ChatGPT-internal citation markers into output_text:
// U+E200 opens, U+E202 separates fields, U+E201 closes. They render as tofu boxes.
const marker = "fileciteturn0file6turn0file7turn0file17"

describe("stripCitationMarkers", () => {
	it("removes a complete filecite marker", () => {
		expect(stripCitationMarkers(`og kapittel 8, «Definisjoner». ${marker}`)).toBe("og kapittel 8, «Definisjoner». ")
	})

	it("removes multiple markers mid-text", () => {
		expect(stripCitationMarkers(`A${marker} B ${marker}C`)).toBe("A B C")
	})

	it("removes an unterminated marker at the end (mid-stream)", () => {
		expect(stripCitationMarkers("Tekst fileciteturn0fi")).toBe("Tekst ")
	})

	it("removes stray marker characters", () => {
		expect(stripCitationMarkers("abc")).toBe("abc")
	})

	it("leaves ordinary text untouched", () => {
		const text = "Hei! æøå 🤖 ```ts\nconst x = 1\n```"
		expect(stripCitationMarkers(text)).toBe(text)
	})
})
