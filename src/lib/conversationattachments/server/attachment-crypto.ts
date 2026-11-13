import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

// Every attachment file in S3 is encrypted with its own random key (AES-256-GCM). The file key is kept in
// the conversation header's attachment list, which is itself encrypted with CONVERSATION_ENCRYPTION_KEYS -
// so rotating the master key only means re-encrypting the header, never rewriting files in S3.
// Files are encrypted regardless of whether CONVERSATION_ENCRYPTION_KEYS is configured: without it the
// file key sits in the header in plaintext, exactly like messages do in that mode, but the file format
// stays the same either way.
//
// Stored format: [version byte][12-byte IV][16-byte auth tag][ciphertext]

const ALGORITHM = "aes-256-gcm"
const FORMAT_VERSION = 1
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16
const KEY_LENGTH_BYTES = 32
const HEADER_LENGTH_BYTES = 1 + IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES

/**
 * Binds a file's ciphertext to the owner, conversation and object it was written for, so an object
 * copied or moved to another key/conversation in S3 fails to decrypt instead of being served there.
 */
export const attachmentAad = (owner: string, conversationId: string, objectId: string): string => `hugin-attachment:v1:${owner}:${conversationId}:${objectId}`

/** A new random object id - also the last segment of the S3 key. */
export const newAttachmentObjectId = (): string => randomBytes(16).toString("hex")

/** Encrypts one file under a fresh random key. Returns the ciphertext and that key (base64). */
export const encryptAttachment = (plaintext: Uint8Array, aad: string): { ciphertext: Uint8Array; fileKey: string } => {
	const key = randomBytes(KEY_LENGTH_BYTES)
	const iv = randomBytes(IV_LENGTH_BYTES)
	const cipher = createCipheriv(ALGORITHM, key, iv)
	cipher.setAAD(Buffer.from(aad, "utf8"))
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
	const ciphertext = Buffer.concat([Buffer.from([FORMAT_VERSION]), iv, cipher.getAuthTag(), encrypted])
	return { ciphertext: new Uint8Array(ciphertext), fileKey: key.toString("base64") }
}

/** Decrypts a file written by encryptAttachment. Throws if the key, the AAD or the bytes don't match. */
export const decryptAttachment = (ciphertext: Uint8Array, fileKey: string, aad: string): Uint8Array => {
	const key = Buffer.from(fileKey, "base64")
	if (key.length !== KEY_LENGTH_BYTES) {
		throw new Error("Invalid attachment file key")
	}
	const raw = Buffer.from(ciphertext.buffer, ciphertext.byteOffset, ciphertext.byteLength)
	if (raw.length < HEADER_LENGTH_BYTES) {
		throw new Error("Attachment ciphertext is too short")
	}
	if (raw[0] !== FORMAT_VERSION) {
		throw new Error(`Unknown attachment format version ${raw[0]}`)
	}
	const iv = raw.subarray(1, 1 + IV_LENGTH_BYTES)
	const authTag = raw.subarray(1 + IV_LENGTH_BYTES, HEADER_LENGTH_BYTES)
	const decipher = createDecipheriv(ALGORITHM, key, iv)
	decipher.setAAD(Buffer.from(aad, "utf8"))
	decipher.setAuthTag(authTag)
	return new Uint8Array(Buffer.concat([decipher.update(raw.subarray(HEADER_LENGTH_BYTES)), decipher.final()]))
}
