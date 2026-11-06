import type { RequestEvent } from "@sveltejs/kit"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { urlForLog } from "$lib/server/middleware/http-request"
import type { TranscriptionStorage } from "$lib/server/transcription/transcription-storage"
import type { TranscriptionJob } from "$lib/server/transcription/types"
import { DELETE, GET, PATCH, POST } from "../../../src/routes/api/transcription/+server"
import { GET as downloadGET } from "../../../src/routes/api/transcription/[id]/download/+server"
import { POST as callbackPOST } from "../../../src/routes/api/transcription/callback/+server"
import { PUT as uploadPUT } from "../../../src/routes/api/transcription/upload/[...path]/+server"
import { load as pageLoad } from "../../../src/routes/transcription/+page.server"
import { TEST_USER_MS_HEADERS } from "../api/test-requests-data"

// Matches .env.tests and the oids in test-requests-data.ts
const EMPLOYEE = "user-oid-1234"
const PRESIGNED = "https://s3.test/hugin-transcription/audio?X-Amz-Signature=abc"
const STORAGE: TranscriptionStorage = { endpoint: "https://s3.test", accessKey: "k", secretKey: "s", region: "us-east-1", bucket: "hugin-transcription" }

// The AWS SDK itself is not under test here - only who may call what, and with which user/job
const storage = vi.hoisted(() => ({
	getTranscriptionStorage: vi.fn(),
	uploadAudio: vi.fn(),
	presignAudioUrl: vi.fn(),
	putDocx: vi.fn(),
	getDocx: vi.fn(),
	deleteAudio: vi.fn(),
	deleteJobFiles: vi.fn()
}))
vi.mock("$lib/server/transcription/transcription-storage", () => storage)

const storageCalls = () => Object.entries(storage).flatMap(([name, fn]) => (name === "getTranscriptionStorage" ? [] : fn.mock.calls.map(() => name)))

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

beforeEach(() => {
	for (const fn of Object.values(storage)) fn.mockReset()
	storage.getTranscriptionStorage.mockReturnValue(STORAGE)
	storage.uploadAudio.mockImplementation(async (_s: TranscriptionStorage, params: { body: ReadableStream }) => {
		// Drain the body like the real upload does, so the byte limit is exercised
		await new Response(params.body).arrayBuffer()
	})
	storage.presignAudioUrl.mockResolvedValue(PRESIGNED)
	storage.getDocx.mockResolvedValue(null)
	fetchMock = vi.fn(async () => Response.json({ job_id: "tale-job-1" }))
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const createJob = async (fileName: string, user: User = "employee"): Promise<TranscriptionJob> => {
	const res = await POST(makeEvent("/api/transcription", { method: "POST", body: { fileName }, user }))
	expect(res.status).toBe(201)
	return ((await res.json()) as { job: TranscriptionJob }).job
}

const uploadPath = (userId: string, jobId: string, fileName: string) => `${encodeURIComponent(userId)}/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`

const upload = (path: string, options: CallOptions = {}) =>
	uploadPUT(makeEvent(`/api/transcription/upload/${path}`, { method: "PUT", rawBody: new Uint8Array(10), params: { path: decodeURI(path) }, ...options }))

const start = (id: string) => PATCH(makeEvent("/api/transcription", { method: "PATCH", body: { id, status: "processing" } }))

const callback = (payload: Record<string, unknown>, secret = "test-secret") => callbackPOST(makeEvent(`/api/transcription/callback?secret=${secret}`, { method: "POST", body: payload }) as never)

const completedPayload = (overrides: Record<string, unknown> = {}) => ({
	job_id: "tale-job-1",
	status: "completed",
	upn: EMPLOYEE,
	completed_at: "2026-11-05T10:00:00.000Z",
	duration_seconds: 12,
	result: { text: "Hei og velkommen.", segments: [], paragraphs: [], docx_url: "http://copyparty.test/ignored.docx" },
	...overrides
})

describe("access control", () => {
	it("denies a student on every transcription API route, without touching S3", async () => {
		const student = { user: "student" as const }
		expect((await GET(makeEvent("/api/transcription", student))).status).toBe(403)
		expect((await POST(makeEvent("/api/transcription", { ...student, method: "POST", body: { fileName: "a.mp3" } }))).status).toBe(403)
		expect((await PATCH(makeEvent("/api/transcription", { ...student, method: "PATCH", body: { id: "x", status: "processing" } }))).status).toBe(403)
		expect((await DELETE(makeEvent("/api/transcription", { ...student, method: "DELETE", body: { id: "x" } }))).status).toBe(403)
		expect((await upload(uploadPath("student-oid-9012", "x", "a.mp3"), student)).status).toBe(403)
		expect((await downloadGET(makeEvent("/api/transcription/x/download", { ...student, params: { id: "x" } }))).status).toBe(403)
		expect(storageCalls()).toEqual([])
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

describe("when S3 storage is not configured", () => {
	it("answers 503 instead of accepting files it cannot store", async () => {
		storage.getTranscriptionStorage.mockReturnValue(null)
		expect((await POST(makeEvent("/api/transcription", { method: "POST", body: { fileName: "a.mp3" } }))).status).toBe(503)
		expect((await upload(uploadPath(EMPLOYEE, "x", "a.mp3"))).status).toBe(503)
		expect((await start("x")).status).toBe(503)
		expect((await DELETE(makeEvent("/api/transcription", { method: "DELETE", body: { id: "x" } }))).status).toBe(503)
		expect((await downloadGET(makeEvent("/api/transcription/x/download", { params: { id: "x" } }))).status).toBe(503)
		expect(storageCalls()).toEqual([])
	})
})

describe("POST /api/transcription", () => {
	it.each(["../x.mp3", "a/b.mp3", "notes.txt"])("rejects fileName %j", async (fileName) => {
		const res = await POST(makeEvent("/api/transcription", { method: "POST", body: { fileName } }))
		expect(res.status).toBe(400)
	})
})

describe("PUT /api/transcription/upload", () => {
	it("streams an upload for a pending job to S3 under the caller's own user and job", async () => {
		const job = await createJob("opptak.webm")
		const res = await upload(uploadPath(EMPLOYEE, job.id, job.fileName))
		expect(res.status).toBe(201)
		expect(storage.uploadAudio).toHaveBeenCalledWith(STORAGE, expect.objectContaining({ userId: EMPLOYEE, jobId: job.id, fileName: "opptak.webm" }))
	})

	it("rejects uploads without a pending job", async () => {
		expect((await upload(uploadPath(EMPLOYEE, "no-such-job", "a.mp3"))).status).toBe(404)
		expect(storage.uploadAudio).not.toHaveBeenCalled()
	})

	it("rejects uploads under a different file name than the job was created with", async () => {
		const job = await createJob("riktig.mp3")
		expect((await upload(uploadPath(EMPLOYEE, job.id, "annet.mp3"))).status).toBe(404)
		expect(storage.uploadAudio).not.toHaveBeenCalled()
	})

	it("rejects uploads into another user's folder", async () => {
		expect((await upload(uploadPath("victim-oid", "x", "a.mp3"))).status).toBe(403)
		expect(storage.uploadAudio).not.toHaveBeenCalled()
	})

	it("rejects a declared Content-Length over the limit with 413", async () => {
		const job = await createJob("stor.mp3")
		const res = await upload(uploadPath(EMPLOYEE, job.id, job.fileName), { headers: { "content-length": String(501 * 1024 * 1024) } })
		expect(res.status).toBe(413)
		expect(storage.uploadAudio).not.toHaveBeenCalled()
	})

	it("answers 502 without internal details when S3 fails", async () => {
		storage.uploadAudio.mockRejectedValue(new Error("connect ECONNREFUSED 10.201.82.131:9000"))
		const job = await createJob("feil.mp3")
		const res = await upload(uploadPath(EMPLOYEE, job.id, job.fileName))
		expect(res.status).toBe(502)
		expect(await res.text()).not.toContain("10.201")
	})

	it("rejects uploads once the job has been started", async () => {
		const job = await createJob("startet.mp3")
		await start(job.id)
		storage.uploadAudio.mockClear()
		expect((await upload(uploadPath(EMPLOYEE, job.id, job.fileName))).status).toBe(404)
		expect(storage.uploadAudio).not.toHaveBeenCalled()
	})
})

describe("PATCH /api/transcription", () => {
	it("starts a job once, handing tale-til-notat a presigned URL for the caller's own audio", async () => {
		const job = await createJob("en-gang.mp3")
		expect((await start(job.id)).status).toBe(200)
		expect((await start(job.id)).status).toBe(409)
		expect(storage.presignAudioUrl).toHaveBeenCalledWith(STORAGE, { userId: EMPLOYEE, jobId: job.id, fileName: "en-gang.mp3" })
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const form = fetchMock.mock.calls[0]?.[1]?.body as FormData
		expect(form.get("source_url")).toBe(PRESIGNED)
		expect(form.get("upn")).toBe(EMPLOYEE)
	})

	it("does not pass tale-til-notat's error details on to the user", async () => {
		fetchMock.mockImplementation(async () => Response.json({ detail: "intern sti /data/secret" }, { status: 422 }))
		const job = await createJob("feil.mp3")
		const res = await start(job.id)
		expect(res.status).toBe(502)
		const body = (await res.json()) as { message: string }
		expect(body.message).not.toContain("secret")
		expect(body.message).toContain("422")
	})
})

describe("DELETE /api/transcription", () => {
	const del = (body: Record<string, unknown>) => DELETE(makeEvent("/api/transcription", { method: "DELETE", body }))

	it("deletes every file of the job under the caller's own prefix, whatever else the client sends", async () => {
		const res = await del({ id: "job-y", fileName: "a.mp3", audioUrl: "https://s3.test/victim-oid/a.mp3", docxUrl: "https://s3.test/victim-oid/a.docx" })
		expect(res.status).toBe(200)
		expect(storage.deleteJobFiles).toHaveBeenCalledWith(STORAGE, { userId: EMPLOYEE, jobId: "job-y" })
		expect(storageCalls()).toEqual(["deleteJobFiles"])
	})

	it("removes an in-memory job from the list", async () => {
		const job = await createJob("slett-meg.mp3")
		await del({ id: job.id })
		const { jobs } = (await (await GET(makeEvent("/api/transcription"))).json()) as { jobs: TranscriptionJob[] }
		expect(jobs.some((j) => j.id === job.id)).toBe(false)
	})

	it.each([{ id: ".." }, { id: "a/b" }, {}])("rejects %j", async (body) => {
		expect((await del(body)).status).toBe(400)
		expect(storageCalls()).toEqual([])
	})
})

describe("POST /api/transcription/callback", () => {
	it("rejects a wrong secret without touching S3", async () => {
		expect((await callback(completedPayload(), "wrong")).status).toBe(401)
		expect(storageCalls()).toEqual([])
	})

	it("stores a Word document built by Hugin, deletes the audio and ignores tale-til-notat's docx_url", async () => {
		const job = await createJob("ferdig.mp3")
		await start(job.id)
		expect((await callback(completedPayload())).status).toBe(200)

		expect(storage.putDocx).toHaveBeenCalledTimes(1)
		const [, params] = storage.putDocx.mock.calls[0] as [TranscriptionStorage, { userId: string; jobId: string; fileName: string; bytes: Uint8Array }]
		expect(params).toMatchObject({ userId: EMPLOYEE, jobId: job.id, fileName: "ferdig.mp3" })
		expect(String.fromCharCode(...params.bytes.slice(0, 2))).toBe("PK") // a .docx is a zip file
		expect(storage.deleteAudio).toHaveBeenCalledWith(STORAGE, { userId: EMPLOYEE, jobId: job.id })

		const { jobs } = (await (await GET(makeEvent("/api/transcription"))).json()) as { jobs: TranscriptionJob[] }
		const listed = jobs.find((j) => j.id === job.id)
		expect(listed).toMatchObject({ status: "completed", hasDocx: true })
		expect(JSON.stringify(listed)).not.toContain("copyparty")
	})

	it("deletes the audio of a failed job and stores no document", async () => {
		const job = await createJob("feilet.mp3")
		await start(job.id)
		await callback(completedPayload({ status: "failed", error: "GPU out of memory", result: null }))
		expect(storage.putDocx).not.toHaveBeenCalled()
		expect(storage.deleteAudio).toHaveBeenCalledWith(STORAGE, { userId: EMPLOYEE, jobId: job.id })
	})

	it("marks the job failed, but still acknowledges the callback, when the document can't be stored", async () => {
		storage.putDocx.mockRejectedValue(new Error("S3 down"))
		const job = await createJob("lagring.mp3")
		await start(job.id)
		expect((await callback(completedPayload())).status).toBe(200)
		const { jobs } = (await (await GET(makeEvent("/api/transcription"))).json()) as { jobs: TranscriptionJob[] }
		expect(jobs.find((j) => j.id === job.id)).toMatchObject({ status: "failed", hasDocx: false })
	})
})

describe("GET /api/transcription/[id]/download", () => {
	const download = (id: string) => downloadGET(makeEvent(`/api/transcription/${id}/download`, { params: { id } }))

	it("streams the caller's own document from S3, named after the original file", async () => {
		storage.getDocx.mockResolvedValue({ body: new Response("docx-bytes").body, originalName: "Møte med Ola.mp3" })
		const res = await download("job-z")
		expect(res.status).toBe(200)
		expect(storage.getDocx).toHaveBeenCalledWith(STORAGE, { userId: EMPLOYEE, jobId: "job-z" })
		expect(res.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
		expect(res.headers.get("content-disposition")).toBe("attachment; filename=\"M_te med Ola.docx\"; filename*=UTF-8''M%C3%B8te%20med%20Ola.docx")
		expect(await res.text()).toBe("docx-bytes")
	})

	it("answers 404 when there is no document", async () => {
		expect((await download("job-none")).status).toBe(404)
	})

	it("rejects a traversing job id without touching S3", async () => {
		expect((await download("..")).status).toBe(400)
		expect(storageCalls()).toEqual([])
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
