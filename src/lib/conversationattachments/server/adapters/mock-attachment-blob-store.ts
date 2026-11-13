import type { IAttachmentBlobStore } from "./interface"

/** In-memory stand-in for S3 (MOCK_DB=true) - lost on restart, like the other mock stores. */
export class MockAttachmentBlobStore implements IAttachmentBlobStore {
	private readonly objects = new Map<string, Uint8Array>()

	async put(key: string, bytes: Uint8Array): Promise<void> {
		this.objects.set(key, new Uint8Array(bytes))
	}

	async get(key: string): Promise<Uint8Array | null> {
		const bytes = this.objects.get(key)
		return bytes ? new Uint8Array(bytes) : null
	}

	async deletePrefix(prefix: string): Promise<void> {
		for (const key of [...this.objects.keys()]) {
			if (key.startsWith(prefix)) {
				this.objects.delete(key)
			}
		}
	}
}
