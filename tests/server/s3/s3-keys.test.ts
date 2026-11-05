import { describe, expect, it } from "vitest"
import { buildObjectKey, sanitizeFileName, userKeyPrefix } from "$lib/server/s3/s3-keys"

describe("sanitizeFileName", () => {
	it.each([
		["rapport.pdf", "rapport.pdf"],
		["møte referat 2026.docx", "møte referat 2026.docx"],
		["a  b.txt", "a b.txt"]
	])("keeps %j readable", (input, expected) => {
		expect(sanitizeFileName(input)).toBe(expected)
	})

	it.each([
		["../../etc/passwd", "passwd"],
		["C:\\Users\\x\\secret.docx", "secret.docx"],
		["a/b/c.txt", "c.txt"]
	])("drops path parts from %j", (input, expected) => {
		expect(sanitizeFileName(input)).toBe(expected)
	})

	it("replaces characters that are unsafe in a key", () => {
		expect(sanitizeFileName("a?b#c%d*e.txt")).toBe("a_b_c_d_e.txt")
	})

	it("removes leading dots", () => {
		expect(sanitizeFileName("..hidden")).toBe("hidden")
	})

	it.each(["", "   ", "...", "/", "\\"])("falls back to a placeholder for %j", (input) => {
		expect(sanitizeFileName(input)).toBe("file")
	})

	it("caps the length and keeps the extension", () => {
		const result = sanitizeFileName(`${"a".repeat(300)}.pdf`)
		expect(result).toHaveLength(120)
		expect(result.endsWith(".pdf")).toBe(true)
	})

	it("caps the length when there is no extension", () => {
		expect(sanitizeFileName("a".repeat(300))).toHaveLength(120)
	})
})

describe("userKeyPrefix", () => {
	it("is the prefix and the user id", () => {
		expect(userKeyPrefix("s3-poc", "user-oid-1234")).toBe("s3-poc/user-oid-1234/")
	})

	it.each(["", ".", "..", "a/b", "a\\b"])("rejects user id %j", (userId) => {
		expect(() => userKeyPrefix("s3-poc", userId)).toThrow()
	})
})

describe("buildObjectKey", () => {
	it("builds <prefix>/<user>/<upload>-<sanitized name>", () => {
		expect(buildObjectKey("s3-poc", "user-oid-1234", "u1", "rapport.pdf")).toBe("s3-poc/user-oid-1234/u1-rapport.pdf")
	})

	it("keeps a hostile file name inside the user's prefix", () => {
		const key = buildObjectKey("s3-poc", "user-oid-1234", "u1", "../../other-user/x.pdf")
		expect(key).toBe("s3-poc/user-oid-1234/u1-x.pdf")
		expect(key.startsWith(userKeyPrefix("s3-poc", "user-oid-1234"))).toBe(true)
	})

	it("rejects an unsafe upload id", () => {
		expect(() => buildObjectKey("s3-poc", "user-oid-1234", "a/b", "x.pdf")).toThrow()
	})
})
