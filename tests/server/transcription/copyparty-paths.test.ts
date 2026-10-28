import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import { buildAudioUrl, isSafePathSegment, limitBytes, resolveOwnDocxUrl, resolveUrlUnderBase } from "$lib/server/transcription/copyparty-paths"

const BASE = "http://copyparty.test/copyparty"
const USER = "3656c983-c859-4a8e-9b2f-0123b2f8d7"

describe("isSafePathSegment", () => {
	it.each(["audio_king.mp3", "møte..final.mp3", "opptak-1790681215910.webm", "a".repeat(255)])("accepts %s", (value) => {
		expect(isSafePathSegment(value)).toBe(true)
	})
	it.each(["", ".", "..", "a/b.mp3", "a\\b.mp3", "../x.mp3", "a".repeat(256)])("rejects %j", (value) => {
		expect(isSafePathSegment(value)).toBe(false)
	})
})

describe("buildAudioUrl", () => {
	it("encodes every segment", () => {
		expect(buildAudioUrl(BASE, USER, "job-1", "møte 1.mp3")).toBe(`${BASE}/${USER}/job-1/m%C3%B8te%201.mp3`)
	})
})

describe("resolveUrlUnderBase", () => {
	it("accepts a URL below the base path", () => {
		expect(resolveUrlUnderBase(BASE, `${BASE}/${USER}/a.docx`)?.href).toBe(`${BASE}/${USER}/a.docx`)
	})
	it.each([
		["another host", "http://evil.test/copyparty/x.docx"],
		["a sibling path sharing the prefix", "http://copyparty.test/copyparty-other/x.docx"],
		["the base itself", BASE],
		["traversal out of the base", `${BASE}/../admin`],
		["encoded traversal out of the base", `${BASE}/%2e%2e/admin`],
		["a query string", `${BASE}/${USER}/a.docx?delete`],
		["not a URL", "nonsense"]
	])("rejects %s", (_label, value) => {
		expect(resolveUrlUnderBase(BASE, value)).toBeNull()
	})
})

describe("resolveOwnDocxUrl", () => {
	it("accepts a .docx directly in the user's folder (the layout tale-til-notat uses)", () => {
		const value = `${BASE}/${USER}/536cded0-4b64-4ace-8589-1045546c6056.docx`
		expect(resolveOwnDocxUrl(BASE, USER, value)?.href).toBe(value)
	})
	it.each([
		["another user's folder", `${BASE}/other-user/a.docx`],
		["the user's folder itself", `${BASE}/${USER}`],
		["a nested path", `${BASE}/${USER}/job/a.docx`],
		["traversal into another folder", `${BASE}/${USER}/../other-user/a.docx`],
		["a non-docx file", `${BASE}/${USER}/audio.mp3`],
		["a sibling base path", `http://copyparty.test/copyparty-other/${USER}/a.docx`]
	])("rejects %s", (_label, value) => {
		expect(resolveOwnDocxUrl(BASE, USER, value)).toBeNull()
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
