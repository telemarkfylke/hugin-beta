import { describe, expect, it } from "vitest"
import { classifyOllamaError } from "$lib/server/ollama/ollama-diagnostics"

const responseError = (status_code: number) => Object.assign(new Error("failed"), { status_code })
const fetchFailed = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } })

describe("classifyOllamaError", () => {
	it.each([
		[401, "auth"],
		[403, "auth"],
		[404, "model-not-found"],
		[502, "bad-gateway"],
		[504, "bad-gateway"],
		[500, "http-error"]
	])("classifies HTTP %i as %s", (status, kind) => {
		expect(classifyOllamaError(responseError(status))).toEqual({ kind, status })
	})

	it.each([
		["ENOTFOUND", "dns"],
		["ECONNREFUSED", "refused"],
		["UND_ERR_CONNECT_TIMEOUT", "timeout"],
		["CERT_HAS_EXPIRED", "tls"],
		["SOMETHING_ELSE", "network"]
	])("classifies socket error %s as %s", (code, kind) => {
		expect(classifyOllamaError(fetchFailed(code))).toEqual({ kind, code })
	})

	it("falls back to unknown for anything else", () => {
		expect(classifyOllamaError(new Error("boom"))).toEqual({ kind: "unknown" })
		expect(classifyOllamaError(null)).toEqual({ kind: "unknown" })
		expect(classifyOllamaError("text")).toEqual({ kind: "unknown" })
	})
})
