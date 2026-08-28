import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"

// Application-layer field encryption for stored conversation data - message pairs
// (userInput/response) and conversation title/summary (see memory
// "hugin-conversation-storage-design" - deferred 2026-08-04, implemented now).
// Only MongoConversationStore should import this module: ConversationManager and everything
// above it always deals with plaintext values, never ciphertext.
//
// Config (both env vars must be set together, or neither):
//   CONVERSATION_ENCRYPTION_KEYS               JSON, e.g. {"2026-08":"<base64 of 32 random bytes>"}
//   CONVERSATION_ENCRYPTION_ACTIVE_KEY  which key version new writes use, e.g. "2026-08"
// Key versions are free-form strings, not necessarily numbers - name them however is useful for
// tracking rotations (a counter, a date, "prod-1", whatever).
// Dev and prod each get their own keyset simply by having their own env/.env - no code branch
// needed for "which environment am I". Generate a key with:
//   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
//
// If neither var is set, encryption is treated as not-yet-configured and values are stored
// as plaintext (no *KeyVersion field set) - this lets the feature roll out without breaking an
// environment whose .env hasn't been updated yet. If the vars ARE set but malformed (bad JSON,
// wrong key length, active version missing from the keyset), that's a real config bug and
// throws immediately rather than silently falling back to plaintext.

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16
const KEY_LENGTH_BYTES = 32

export type EncryptedValue = {
	data: string
	encryptionKeyVersion: string
}

type EncryptionConfig = {
	keyRing: Map<string, Buffer>
	activeKeyVersion: string
}

let config: EncryptionConfig | null = null
let configChecked = false

const parseConfig = (): EncryptionConfig | null => {
	const rawKeys = env.CONVERSATION_ENCRYPTION_KEYS
	const rawActiveVersion = env.CONVERSATION_ENCRYPTION_ACTIVE_KEY

	if (!rawKeys && !rawActiveVersion) {
		return null
	}
	if (!rawKeys || !rawActiveVersion) {
		throw new Error("CONVERSATION_ENCRYPTION_KEYS and CONVERSATION_ENCRYPTION_ACTIVE_KEY must both be set, or neither")
	}

	let parsedKeys: Record<string, string>
	try {
		parsedKeys = JSON.parse(rawKeys)
	} catch (error) {
		throw new Error("CONVERSATION_ENCRYPTION_KEYS is not valid JSON", { cause: error })
	}

	const keyRing = new Map<string, Buffer>()
	for (const [version, base64Key] of Object.entries(parsedKeys)) {
		if (!version) {
			throw new Error("CONVERSATION_ENCRYPTION_KEYS has an empty key version")
		}
		const key = Buffer.from(base64Key, "base64")
		if (key.length !== KEY_LENGTH_BYTES) {
			throw new Error(`CONVERSATION_ENCRYPTION_KEYS version "${version}" decodes to ${key.length} bytes, expected ${KEY_LENGTH_BYTES} (base64 of 32 raw bytes)`)
		}
		keyRing.set(version, key)
	}

	if (!keyRing.has(rawActiveVersion)) {
		throw new Error(`CONVERSATION_ENCRYPTION_ACTIVE_KEY ("${rawActiveVersion}") has no matching entry in CONVERSATION_ENCRYPTION_KEYS`)
	}

	return { keyRing, activeKeyVersion: rawActiveVersion }
}

const getConfig = (): EncryptionConfig | null => {
	if (!configChecked) {
		configChecked = true
		try {
			config = parseConfig()
			if (!config) {
				logger.warn("CONVERSATION_ENCRYPTION_KEYS is not set - conversation messages will be stored unencrypted")
			}
		} catch (error) {
			// Must not throw out of here: this runs inline in the per-message persist path
			// (toDbMessagePair, before the DB insertOne), which callers treat as fire-and-forget
			// (see +server.ts's appendConversationMessage call, logged and swallowed on failure).
			// Letting a malformed config throw would silently drop the message entirely - the
			// conversation header still gets created, but the message pair never reaches the DB,
			// producing a conversation that looks empty. Log loudly instead so the misconfiguration
			// is actually visible, then degrade exactly like "vars not set" does: plaintext until
			// someone fixes the env vars and restarts. (Every subsequent call reuses this cached
			// `null` too - there'd be no point re-parsing the same broken env on every message.)
			logger.errorException(error, "CONVERSATION_ENCRYPTION_KEYS/CONVERSATION_ENCRYPTION_ACTIVE_KEY is set but invalid - conversation messages will be stored unencrypted until this is fixed")
			config = null
		}
	}
	return config
}

export const isEncryptionConfigured = (): boolean => getConfig() !== null

/** JSON-serializes `value` and encrypts it with the active key version. */
export const encryptValue = (value: unknown): EncryptedValue => {
	const activeConfig = getConfig()
	if (!activeConfig) {
		throw new Error("Cannot encrypt: encryption is not configured")
	}
	const key = activeConfig.keyRing.get(activeConfig.activeKeyVersion) as Buffer

	const iv = randomBytes(IV_LENGTH_BYTES)
	const cipher = createCipheriv(ALGORITHM, key, iv)
	const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
	const authTag = cipher.getAuthTag()

	return {
		data: Buffer.concat([iv, authTag, ciphertext]).toString("base64"),
		encryptionKeyVersion: activeConfig.activeKeyVersion
	}
}

/** Decrypts `data` using `encryptionKeyVersion` (which may be older than the currently active version) and JSON-parses the result. */
export const decryptValue = <T>(data: string, encryptionKeyVersion: string): T => {
	const activeConfig = getConfig()
	if (!activeConfig) {
		throw new Error("Cannot decrypt: encryption is not configured")
	}
	const key = activeConfig.keyRing.get(encryptionKeyVersion)
	if (!key) {
		throw new Error(
			`Cannot decrypt: no key configured for version ${encryptionKeyVersion} (rotated-out keys must stay in CONVERSATION_ENCRYPTION_KEYS until every message using them has been re-encrypted)`
		)
	}

	const raw = Buffer.from(data, "base64")
	const iv = raw.subarray(0, IV_LENGTH_BYTES)
	const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
	const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)

	const decipher = createDecipheriv(ALGORITHM, key, iv)
	decipher.setAuthTag(authTag)
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
	return JSON.parse(plaintext) as T
}
