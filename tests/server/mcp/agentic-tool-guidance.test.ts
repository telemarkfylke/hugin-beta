import { describe, expect, it } from "vitest"
import { appendAgenticToolGuidance } from "../../../src/lib/server/mcp/agentic-tool-guidance"

describe("appendAgenticToolGuidance", () => {
	it("appends the guidance after existing instructions", () => {
		const result = appendAgenticToolGuidance("Du er en hjelpsom assistent.")
		expect(result.startsWith("Du er en hjelpsom assistent.")).toBe(true)
		expect(result).toContain("Bruk disse verktøyene aktivt")
	})

	it("returns just the guidance when there are no existing instructions", () => {
		const result = appendAgenticToolGuidance(undefined)
		expect(result).toContain("Bruk disse verktøyene aktivt")
	})

	it("tells the model not to guess folder/file names - the specific failure this was added for", () => {
		const result = appendAgenticToolGuidance(undefined)
		expect(result).toContain("Gjett ALDRI mappe- eller filnavn")
	})
})
