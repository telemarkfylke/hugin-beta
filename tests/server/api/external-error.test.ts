import { describe, expect, it } from "vitest"
import { externalErrorToHTTPError } from "$lib/server/middleware/external-error"
import { HTTPError } from "$lib/server/middleware/http-error"

describe("externalErrorToHTTPError", () => {
	it("maps provider 413 errors to HTTP 413 with useful context", () => {
		const providerError = Object.assign(new Error("Payload too large"), {
			statusCode: 413,
			body: "file too large"
		})

		const result = externalErrorToHTTPError(providerError, "Mistral")

		expect(result).toBeInstanceOf(HTTPError)
		expect(result?.status).toBe(413)
		expect(result?.message).toContain("too large")
		expect(result?.data).toEqual({ provider: "Mistral", providerStatus: 413, providerMessage: "Payload too large", providerBody: "file too large" })
	})

	it("maps provider auth errors to bad gateway to avoid blaming the user", () => {
		const providerError = Object.assign(new Error("Unauthorized"), { statusCode: 401 })

		const result = externalErrorToHTTPError(providerError, "Mistral")

		expect(result?.status).toBe(502)
	})

	it("ignores errors without provider status", () => {
		expect(externalErrorToHTTPError(new Error("boom"), "Mistral")).toBeNull()
	})
})
