import { randomBytes } from "node:crypto"
import { describe, expect, it, vi } from "vitest"

const loadWithKeys = async () => {
	vi.resetModules()
	vi.doMock("$env/dynamic/private", () => ({
		env: {
			CONVERSATION_ENCRYPTION_KEYS: JSON.stringify({ "test-1": randomBytes(32).toString("base64") }),
			CONVERSATION_ENCRYPTION_ACTIVE_KEY: "test-1"
		}
	}))
	return await import("../../../src/lib/conversationstore/server/message-encryption")
}

describe("message-encryption AAD binding", () => {
	it("round-trips a value encrypted with AAD when the same AAD is supplied", async () => {
		const { encryptValue, decryptValue } = await loadWithKeys()
		const encrypted = encryptValue({ text: "hei" }, "hugin-conversation:v1:kari:conv1:userInput")
		expect(decryptValue(encrypted.data, encrypted.encryptionKeyVersion, "hugin-conversation:v1:kari:conv1:userInput")).toEqual({ text: "hei" })
	})

	it("fails to decrypt when the AAD differs (e.g. owner rewritten in the DB)", async () => {
		const { encryptValue, decryptValue } = await loadWithKeys()
		const encrypted = encryptValue({ text: "hei" }, "hugin-conversation:v1:kari:conv1:userInput")
		expect(() => decryptValue(encrypted.data, encrypted.encryptionKeyVersion, "hugin-conversation:v1:ola:conv1:userInput")).toThrow()
	})

	it("fails to decrypt AAD-bound ciphertext when the AAD is omitted (aadVersion stripped)", async () => {
		const { encryptValue, decryptValue } = await loadWithKeys()
		const encrypted = encryptValue({ text: "hei" }, "hugin-conversation:v1:kari:conv1:userInput")
		expect(() => decryptValue(encrypted.data, encrypted.encryptionKeyVersion)).toThrow()
	})

	it("still decrypts legacy ciphertext written without AAD", async () => {
		const { encryptValue, decryptValue } = await loadWithKeys()
		const encrypted = encryptValue({ text: "gammel" })
		expect(decryptValue(encrypted.data, encrypted.encryptionKeyVersion)).toEqual({ text: "gammel" })
	})

	it("fails to decrypt legacy ciphertext if AAD is wrongly applied to it", async () => {
		const { encryptValue, decryptValue } = await loadWithKeys()
		const encrypted = encryptValue({ text: "gammel" })
		expect(() => decryptValue(encrypted.data, encrypted.encryptionKeyVersion, "hugin-conversation:v1:kari:conv1:userInput")).toThrow()
	})
})
