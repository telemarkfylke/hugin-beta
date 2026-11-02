import { describe, expect, it } from "vitest"
import { buildOllamaHeaders } from "$lib/server/ollama/ollama-headers"

describe("buildOllamaHeaders", () => {
	it("sends no headers when no credentials are configured", () => {
		expect(buildOllamaHeaders(undefined)).toEqual({})
		expect(buildOllamaHeaders("")).toEqual({})
	})

	it("encodes user:password as a basic auth header", () => {
		expect(buildOllamaHeaders("hugin:s3cret")).toEqual({ Authorization: "Basic aHVnaW46czNjcmV0" })
	})

	it("keeps a colon inside the password", () => {
		const header = buildOllamaHeaders("hugin:a:b").Authorization as string
		expect(Buffer.from(header.replace("Basic ", ""), "base64").toString()).toBe("hugin:a:b")
	})
})
