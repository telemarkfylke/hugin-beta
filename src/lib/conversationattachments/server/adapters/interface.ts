/**
 * Where the (already encrypted) bytes of conversation attachments are kept. Only ever sees opaque
 * ciphertext and keys from attachment-keys.ts - encryption and access checks happen above this.
 */
export interface IAttachmentBlobStore {
	put(key: string, bytes: Uint8Array): Promise<void>
	/** The object's bytes, or null if there is no object with this key. */
	get(key: string): Promise<Uint8Array | null>
	/** Deletes every object whose key starts with prefix. */
	deletePrefix(prefix: string): Promise<void>
}
