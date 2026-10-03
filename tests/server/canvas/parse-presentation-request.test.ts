import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import { parsePresentationRequest } from "$lib/validation/parse-presentation-request"

describe("parsePresentationRequest", () => {
	it("parses a valid body with slides and prompt", () => {
		const result = parsePresentationRequest({ slides: "# Title\n---\n## Slide 2", prompt: "Add a slide" })
		expect(result).toEqual({ slides: "# Title\n---\n## Slide 2", prompt: "Add a slide" })
	})

	it("defaults slides to an empty string when omitted", () => {
		const result = parsePresentationRequest({ prompt: "Create a deck about onboarding" })
		expect(result.slides).toBe("")
	})

	it("throws 400 when prompt is missing", () => {
		expect(() => parsePresentationRequest({ slides: "" })).toThrow(HTTPError)
	})

	it("throws 400 when prompt is an empty string", () => {
		expect(() => parsePresentationRequest({ slides: "", prompt: "   " })).toThrow(HTTPError)
	})

	it("throws 400 when slides is not a string", () => {
		expect(() => parsePresentationRequest({ slides: 123, prompt: "hi" })).toThrow(HTTPError)
	})

	it("throws 400 when input is not an object", () => {
		expect(() => parsePresentationRequest("not an object")).toThrow(HTTPError)
	})

	it("throws 400 when slides exceeds the max length", () => {
		const tooLong = "a".repeat(10 * 1024 * 1024 + 1)
		expect(() => parsePresentationRequest({ slides: tooLong, prompt: "hi" })).toThrow(HTTPError)
	})
})
