import { describe, expect, it } from "vitest"
import { isSafePathSegment, limitBytes } from "$lib/server/files/upload-guards"
import { HTTPError } from "$lib/server/middleware/http-error"

describe("isSafePathSegment", () => {
	it.each(["audio_king.mp3", "møte..final.mp3", "opptak-1790681215910.webm", "a".repeat(255)])("accepts %s", (value) => {
		expect(isSafePathSegment(value)).toBe(true)
	})
	it.each(["", ".", "..", "a/b.mp3", "a\\b.mp3", "../x.mp3", "a".repeat(256)])("rejects %j", (value) => {
		expect(isSafePathSegment(value)).toBe(false)
	})
})

describe("limitBytes", () => {
	const streamOf = (size: number) => new Response(new Uint8Array(size)).body as ReadableStream<Uint8Array>

	it("passes a body within the limit through unchanged", async () => {
		const out = await new Response(streamOf(5).pipeThrough(limitBytes(5))).arrayBuffer()
		expect(out.byteLength).toBe(5)
	})
	it("errors with 413 once the limit is exceeded", async () => {
		const error = await new Response(streamOf(6).pipeThrough(limitBytes(5))).arrayBuffer().catch((e: unknown) => e)
		expect(error).toBeInstanceOf(HTTPError)
		expect((error as HTTPError).status).toBe(413)
	})
})
