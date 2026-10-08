import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import { parsePresentationExportRequest } from "$lib/validation/parse-presentation-export-request"

describe("parsePresentationExportRequest", () => {
	it("parses a valid body", () => {
		const result = parsePresentationExportRequest({ slides: "# Title\n---\n## Slide 2" })
		expect(result).toEqual({ slides: "# Title\n---\n## Slide 2" })
	})

	it("throws 400 when slides is missing", () => {
		expect(() => parsePresentationExportRequest({})).toThrow(HTTPError)
	})

	it("throws 400 when slides is not a string", () => {
		expect(() => parsePresentationExportRequest({ slides: 42 })).toThrow(HTTPError)
	})

	it("throws 400 when input is not an object", () => {
		expect(() => parsePresentationExportRequest(null)).toThrow(HTTPError)
	})

	it("throws 400 when slides exceeds the max length", () => {
		const tooLong = "a".repeat(10 * 1024 * 1024 + 1)
		expect(() => parsePresentationExportRequest({ slides: tooLong })).toThrow(HTTPError)
	})
})
