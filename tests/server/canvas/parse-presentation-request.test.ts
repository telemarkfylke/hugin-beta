import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import { parsePresentationRequest } from "$lib/validation/parse-presentation-request"

describe("parsePresentationRequest", () => {
	it("accepts a valid request", () => {
		const result = parsePresentationRequest({ slides: "# Title\n---\n# Slide 2", prompt: "Legg til en slide om Telemark" })
		expect(result).toEqual({ slides: "# Title\n---\n# Slide 2", prompt: "Legg til en slide om Telemark" })
	})

	it("accepts an empty slides string (new presentation)", () => {
		const result = parsePresentationRequest({ slides: "", prompt: "Lag en presentasjon om Telemark" })
		expect(result.slides).toBe("")
	})

	it("rejects a non-object body", () => {
		expect(() => parsePresentationRequest(null)).toThrow(HTTPError)
		expect(() => parsePresentationRequest("nope")).toThrow(HTTPError)
	})

	it("rejects a non-string slides field", () => {
		expect(() => parsePresentationRequest({ slides: 123, prompt: "x" })).toThrow(HTTPError)
	})

	it("rejects an empty or missing prompt", () => {
		expect(() => parsePresentationRequest({ slides: "", prompt: "" })).toThrow(HTTPError)
		expect(() => parsePresentationRequest({ slides: "" })).toThrow(HTTPError)
	})

	it("rejects an oversized slides field", () => {
		const huge = "a".repeat(10 * 1024 * 1024 + 1)
		expect(() => parsePresentationRequest({ slides: huge, prompt: "x" })).toThrow(HTTPError)
	})
})
