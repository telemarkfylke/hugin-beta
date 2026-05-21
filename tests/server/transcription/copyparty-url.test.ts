import { describe, expect, it } from "vitest"
import { isTrustedCopypartyUrl } from "$lib/server/transcription/copyparty-url"

const BASE = "https://copyparty.example.com"

describe("isTrustedCopypartyUrl", () => {
	it("accepts a URL on the same origin", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/user/file.mp3", BASE)).toBe(true)
	})

	it("accepts a URL when base has a trailing slash", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/user/file.mp3", "https://copyparty.example.com/")).toBe(true)
	})

	it("rejects a URL on a different host", () => {
		expect(isTrustedCopypartyUrl("https://evil.example.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL that starts with the base string but has a different host", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com.evil.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL with a different scheme", () => {
		expect(isTrustedCopypartyUrl("http://copyparty.example.com/file.mp3", BASE)).toBe(false)
	})

	it("rejects a URL with a different port", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com:8080/file.mp3", BASE)).toBe(false)
	})

	it("returns false for a malformed URL", () => {
		expect(isTrustedCopypartyUrl("not-a-url", BASE)).toBe(false)
	})

	it("returns false for a malformed base", () => {
		expect(isTrustedCopypartyUrl("https://copyparty.example.com/file.mp3", "not-a-base")).toBe(false)
	})

	it("returns false when url is empty string", () => {
		expect(isTrustedCopypartyUrl("", BASE)).toBe(false)
	})
})
