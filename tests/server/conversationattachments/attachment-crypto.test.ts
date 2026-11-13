import { describe, expect, it } from "vitest"
import { attachmentAad, decryptAttachment, encryptAttachment, newAttachmentObjectId } from "$lib/conversationattachments/server/attachment-crypto"

const bytes = new TextEncoder().encode("%PDF-1.7 hemmelig innhold")
const aad = attachmentAad("kari", "conv1", "obj1")

describe("attachment-crypto", () => {
	it("round-trips a file with its own key and the same AAD", () => {
		const { ciphertext, fileKey } = encryptAttachment(bytes, aad)
		expect(decryptAttachment(ciphertext, fileKey, aad)).toEqual(bytes)
	})

	it("does not contain the plaintext", () => {
		const { ciphertext } = encryptAttachment(bytes, aad)
		expect(Buffer.from(ciphertext).includes(Buffer.from("hemmelig"))).toBe(false)
	})

	it("uses a fresh key and IV every time, even for the same file", () => {
		const first = encryptAttachment(bytes, aad)
		const second = encryptAttachment(bytes, aad)
		expect(first.fileKey).not.toBe(second.fileKey)
		expect(Buffer.from(first.ciphertext).equals(Buffer.from(second.ciphertext))).toBe(false)
	})

	it("fails with another file's key", () => {
		const { ciphertext } = encryptAttachment(bytes, aad)
		const other = encryptAttachment(bytes, aad)
		expect(() => decryptAttachment(ciphertext, other.fileKey, aad)).toThrow()
	})

	it.each([
		["owner", attachmentAad("ola", "conv1", "obj1")],
		["conversation", attachmentAad("kari", "conv2", "obj1")],
		["object", attachmentAad("kari", "conv1", "obj2")]
	])("fails when the %s in the AAD differs (object moved/copied in S3)", (_, otherAad) => {
		const { ciphertext, fileKey } = encryptAttachment(bytes, aad)
		expect(() => decryptAttachment(ciphertext, fileKey, otherAad)).toThrow()
	})

	it("fails when the ciphertext is tampered with", () => {
		const { ciphertext, fileKey } = encryptAttachment(bytes, aad)
		const tampered = new Uint8Array(ciphertext)
		tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1
		expect(() => decryptAttachment(tampered, fileKey, aad)).toThrow()
	})

	it("rejects an unknown format version, a truncated file and a bad key", () => {
		const { ciphertext, fileKey } = encryptAttachment(bytes, aad)
		const wrongVersion = new Uint8Array(ciphertext)
		wrongVersion[0] = 99
		expect(() => decryptAttachment(wrongVersion, fileKey, aad)).toThrow(/version/)
		expect(() => decryptAttachment(ciphertext.subarray(0, 10), fileKey, aad)).toThrow(/too short/)
		expect(() => decryptAttachment(ciphertext, "dGVzdA==", aad)).toThrow(/key/)
	})

	it("round-trips an empty file", () => {
		const { ciphertext, fileKey } = encryptAttachment(new Uint8Array(), aad)
		expect(decryptAttachment(ciphertext, fileKey, aad)).toEqual(new Uint8Array())
	})

	it("generates random, path-safe object ids", () => {
		const id = newAttachmentObjectId()
		expect(id).toMatch(/^[0-9a-f]{32}$/)
		expect(newAttachmentObjectId()).not.toBe(id)
	})
})
