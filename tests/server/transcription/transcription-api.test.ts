import type { RequestEvent } from "@sveltejs/kit"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { urlForLog } from "$lib/server/middleware/http-request"
import { applyCallback } from "$lib/server/transcription/job-store"
import type { TranscriptionJob } from "$lib/server/transcription/types"
import { DELETE, GET, PATCH, POST } from "../../../src/routes/api/transcription/+server"
import { GET as downloadGET } from "../../../src/routes/api/transcription/[id]/download/+server"
import { PUT as uploadPUT } from "../../../src/routes/api/transcription/upload/[...path]/+server"
import { load as pageLoad } from "../../../src/routes/transcription/+page.server"
import { TEST_USER_MS_HEADERS } from "../api/test-requests-data"

// Matches .env.tests and the oids in test-requests-data.ts
const BASE = "http://copyparty.test/copyparty"
const EMPLOYEE = "user-oid-1234"
const OWN_FOLDER = `${BASE}/${EMPLOYEE}/`

type User = keyof typeof TEST_USER_MS_HEADERS
type CallOptions = { method?: string; body?: unknown; rawBody?: BodyInit; headers?: Record<string, string>; params?: Record<string, string>; user?: User }

const makeEvent = (path: string, { method = "GET", body, rawBody, headers = {}, params = {}, user = "employee" }: CallOptions = {}): RequestEvent => {
	const request = new Request(`http://hugin.test${path}`, {
		method,
		headers: { [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS[user], ...headers },
		...(rawBody !== undefined ? { body: rawBody } : body !== undefined ? { body: JSON.stringify(body) } : {})
	})
	return { request, params, url: new URL(request.url) } as unknown as RequestEvent
}

let fetchMock: ReturnType<typeof vi.fn>
const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url))

beforeEach(() => {
	fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
		if (String(url).startsWith("http://tale.test")) return Response.json({ job_id: "tale-job-1" })
		// Drain streamed bodies so the upload byte limit is exercised like a real fetch would
		if (init?.body instanceof ReadableStream) await new Response(init.body).arrayBuffer()
		return new Response(null, { status: 201 })
	})
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const createJob = async (fileName: string): Promise<TranscriptionJob> => {
	const res = await POST(makeEvent("/api/transcription", { method: "POST", body: { fileName } }))
	expect(res.status).toBe(201)
	return ((await res.json()) as { job: TranscriptionJob }).job
}

const uploadPath = (userId: string, jobId: string, fileName: string) => `${encodeURIComponent(userId)}/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`

const upload = (path: string, options: CallOptions = {}) =>
	uploadPUT(makeEvent(`/api/transcription/upload/${path}`, { method: "PUT", rawBody: new Uint8Array(10), params: { path: decodeURI(path) }, ...options }))

describe("access control", () => {
	it("denies a student on every transcription API route", async () => {
		const student = { user: "student" as const }
		expect((await GET(makeEvent("/api/transcription", student))).status).toBe(403)
		expect((await POST(makeEvent("/api/transcription", { ...student, method: "POST", body: { fileName: "a.mp3" } }))).status).toBe(403)
		expect((await PATCH(makeEvent("/api/transcription", { ...student, method: "PATCH", body: { id: "x", status: "processing" } }))).status).toBe(403)
		expect((await DELETE(makeEvent("/api/transcription", { ...student, method: "DELETE", body: { id: "x", fileName: "a.mp3" } }))).status).toBe(403)
		expect((await upload(uploadPath("student-oid-9012", "x", "a.mp3"), student)).status).toBe(403)
		expect((await downloadGET(makeEvent("/api/transcription/x/download", { ...student, params: { id: "x" } }))).status).toBe(403)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("denies a student the transcription page", async () => {
		const error = await (pageLoad as (e: RequestEvent) => Promise<unknown>)(makeEvent("/transcription", { user: "student" })).catch((e: unknown) => e)
		expect(error).toMatchObject({ status: 403 })
	})

	it("allows employees and admins", async () => {
		expect((await GET(makeEvent("/api/transcription"))).status).toBe(200)
		expect((await GET(makeEvent("/api/transcription", { user: "admin" }))).status).toBe(200)
		await expect((pageLoad as (e: RequestEvent) => Promise<unknown>)(makeEvent("/transcription"))).resolves.toEqual({})
	})
})

describe("POST /api/transcription", () => {
	it.each(["../x.mp3", "a/b.mp3", "notes.txt"])("rejects fileName %j", async (fileName) => {
		const res = await POST(makeEvent("/api/transcription", { method: "POST", body: { fileName } }))
		expect(res.status).toBe(400)
	})
})

describe("DELETE /api/transcription", () => {
	const del = (body: Record<string, unknown>) => DELETE(makeEvent("/api/transcription", { method: "DELETE", body }))

	it("never deletes outside the caller's own folder, whatever URLs the client sends", async () => {
		const res = await del({
			id: "not-a-real-job",
			fileName: "a.mp3",
			audioUrl: `${BASE}/victim-oid`,
			docxUrl: `${BASE}/victim-oid/536cded0.docx`
		})
		expect(res.status).toBe(200)
		expect(calledUrls()).toEqual([`${OWN_FOLDER}not-a-real-job/a.mp3?delete`])
	})

	it("ignores a client docxUrl that traverses out of the caller's folder", async () => {
		await del({ id: "job-x", fileName: "a.mp3", audioUrl: `${OWN_FOLDER}job-x/a.mp3`, docxUrl: `${OWN_FOLDER}../victim-oid/a.docx` })
		expect(calledUrls()).toEqual([`${OWN_FOLDER}job-x/a.mp3?delete`])
	})

	it("deletes a job known only from localStorage (after a restart): audio and own docx", async () => {
		await del({ id: "job-y", fileName: "a.mp3", audioUrl: `${OWN_FOLDER}job-y/a.mp3`, docxUrl: `${OWN_FOLDER}536cded0.docx` })
		expect(calledUrls()).toEqual([`${OWN_FOLDER}job-y/a.mp3?delete`, `${OWN_FOLDER}536cded0.docx?delete`])
	})

	it("falls back to the legacy <user>/<fileName> path when the client has no audioUrl", async () => {
		await del({ id: "old-job", fileName: "gammel.mp3", audioUrl: null })
		expect(calledUrls()).toEqual([`${OWN_FOLDER}gammel.mp3?delete`])
	})

	it.each([
		{ id: "..", fileName: "a.mp3" },
		{ id: "x", fileName: "../a.mp3" }
	])("rejects path traversal in %j", async (body) => {
		expect((await del(body)).status).toBe(400)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("uses the server-side URLs of an in-memory job", async () => {
		const job = await createJob("slett-meg.mp3")
		await del({ id: job.id, fileName: job.fileName, audioUrl: `${BASE}/victim-oid` })
		expect(calledUrls()).toEqual([`${OWN_FOLDER}${job.id}/slett-meg.mp3?delete`])
	})
})

describe("PUT /api/transcription/upload", () => {
	it("forwards an upload for a pending job to the user's own job folder", async () => {
		const job = await createJob("opptak.webm")
		const res = await upload(uploadPath(EMPLOYEE, job.id, job.fileName))
		expect(res.status).toBe(201)
		expect(calledUrls()).toEqual([`${OWN_FOLDER}${job.id}/opptak.webm`])
	})

	it("rejects uploads without a pending job", async () => {
		expect((await upload(uploadPath(EMPLOYEE, "no-such-job", "a.mp3"))).status).toBe(404)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("rejects uploads under a different file name than the job was created with", async () => {
		const job = await createJob("riktig.mp3")
		expect((await upload(uploadPath(EMPLOYEE, job.id, "annet.mp3"))).status).toBe(404)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("rejects uploads into another user's folder", async () => {
		expect((await upload(uploadPath("victim-oid", "x", "a.mp3"))).status).toBe(403)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("rejects a declared Content-Length over the limit with 413", async () => {
		const job = await createJob("stor.mp3")
		const res = await upload(uploadPath(EMPLOYEE, job.id, job.fileName), { headers: { "content-length": String(501 * 1024 * 1024) } })
		expect(res.status).toBe(413)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("rejects uploads once the job has been started", async () => {
		const job = await createJob("startet.mp3")
		await PATCH(makeEvent("/api/transcription", { method: "PATCH", body: { id: job.id, status: "processing" } }))
		fetchMock.mockClear()
		expect((await upload(uploadPath(EMPLOYEE, job.id, job.fileName))).status).toBe(404)
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

describe("PATCH /api/transcription", () => {
	const patch = (id: string) => PATCH(makeEvent("/api/transcription", { method: "PATCH", body: { id, status: "processing" } }))

	it("starts a job once and refuses to start it again", async () => {
		const job = await createJob("en-gang.mp3")
		expect((await patch(job.id)).status).toBe(200)
		expect((await patch(job.id)).status).toBe(409)
		const taleCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("http://tale.test"))
		expect(taleCalls).toHaveLength(1)
		const form = taleCalls[0]?.[1]?.body as FormData
		expect(form.get("source_url")).toBe(`${OWN_FOLDER}${job.id}/en-gang.mp3`)
	})

	it("does not pass tale-til-notat's error details on to the user", async () => {
		fetchMock.mockImplementation(async () => Response.json({ detail: "intern sti /data/secret" }, { status: 422 }))
		const job = await createJob("feil.mp3")
		const res = await patch(job.id)
		expect(res.status).toBe(502)
		const body = (await res.json()) as { message: string }
		expect(body.message).not.toContain("secret")
		expect(body.message).toContain("422")
	})
})

describe("GET /api/transcription/[id]/download", () => {
	const completeWithDocx = async (fileName: string, docxUrl: string) => {
		const job = await createJob(fileName)
		await PATCH(makeEvent("/api/transcription", { method: "PATCH", body: { id: job.id, status: "processing" } }))
		applyCallback({ job_id: "tale-job-1", status: "completed", upn: EMPLOYEE, completed_at: new Date().toISOString(), result: { text: "", segments: [], paragraphs: [], docx_url: docxUrl } })
		fetchMock.mockClear()
		return job
	}

	it.each(["http://evil.test/x.docx", "http://copyparty.test/copyparty-other/x.docx"])("refuses to fetch a docx_url outside Copyparty: %s", async (docxUrl) => {
		const job = await completeWithDocx("ssrf.mp3", docxUrl)
		const res = await downloadGET(makeEvent(`/api/transcription/${job.id}/download`, { params: { id: job.id } }))
		expect(res.status).toBe(502)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("streams a docx from the user's folder", async () => {
		const job = await completeWithDocx("ok.mp3", `${OWN_FOLDER}abc.docx`)
		fetchMock.mockImplementation(async () => new Response("docx-bytes"))
		const res = await downloadGET(makeEvent(`/api/transcription/${job.id}/download`, { params: { id: job.id } }))
		expect(res.status).toBe(200)
		expect(res.headers.get("content-disposition")).toBe('attachment; filename="ok.docx"')
		expect(calledUrls()).toEqual([`${OWN_FOLDER}abc.docx`])
	})
})

describe("urlForLog", () => {
	it("redacts the user id, job id and file name of transcription uploads", () => {
		expect(urlForLog("https://hugin.test/api/transcription/upload/oid/job/Samtale%20med%20Ola.mp3")).toBe("https://hugin.test/api/transcription/upload/[redacted]")
	})
	it("leaves other URLs unchanged", () => {
		expect(urlForLog("https://hugin.test/api/transcription/abc/download")).toBe("https://hugin.test/api/transcription/abc/download")
	})
})
