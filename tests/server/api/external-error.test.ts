import { describe, expect, it } from "vitest"
import { externalErrorToHTTPError } from "$lib/server/middleware/external-error"

class FakeProviderError extends Error {
	status: number
	body: string
	constructor(status: number, message: string, body: string) {
		super(message)
		this.status = status
		this.body = body
	}
}

describe("externalErrorToHTTPError", () => {
	it("returns null for non-Error values", () => {
		expect(externalErrorToHTTPError("not an error", "OpenAI")).toBeNull()
		expect(externalErrorToHTTPError(null, "OpenAI")).toBeNull()
		expect(externalErrorToHTTPError({ status: 400 }, "OpenAI")).toBeNull()
	})

	it("returns null for errors without a numeric status/statusCode", () => {
		expect(externalErrorToHTTPError(new Error("network failure"), "OpenAI")).toBeNull()
	})

	it("maps provider 429 to HTTP 429", () => {
		const err = new FakeProviderError(429, "Rate limited", "")
		const result = externalErrorToHTTPError(err, "OpenAI")
		expect(result?.status).toBe(429)
	})

	it("maps provider 401 to HTTP 502 (auth is internal)", () => {
		const err = new FakeProviderError(401, "Unauthorized", "")
		const result = externalErrorToHTTPError(err, "OpenAI")
		expect(result?.status).toBe(502)
	})

	it("does NOT include providerMessage or providerBody in the error data sent to clients", () => {
		const err = new FakeProviderError(429, "Rate limit exceeded with internal context", JSON.stringify({ secret: "internal" }))
		const result = externalErrorToHTTPError(err, "OpenAI")
		expect(result).not.toBeNull()
		const data = result?.data as Record<string, unknown>
		expect(data).not.toHaveProperty("providerMessage")
		expect(data).not.toHaveProperty("providerBody")
	})

	it("includes only provider name and status in client-facing data", () => {
		const err = new FakeProviderError(400, "Bad input", "error body text")
		const result = externalErrorToHTTPError(err, "Mistral")
		expect(result).not.toBeNull()
		const data = result?.data as Record<string, unknown>
		expect(data.provider).toBe("Mistral")
		expect(data.providerStatus).toBe(400)
	})
})
