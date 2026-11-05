import type { RequestEvent } from "@sveltejs/kit"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import type { S3PocConfig } from "$lib/server/s3/s3-poc"
import { GET, PUT } from "../../../src/routes/api/s3-poc/+server"
import { load as pageLoad } from "../../../src/routes/s3-poc/+page.server"
import { TEST_USER_MS_HEADERS } from "../api/test-requests-data"

const CONFIG: S3PocConfig = { endpoint: "http://s3.test", accessKey: "k", secretKey: "s", bucket: "hugin-poc", region: "us-east-1", keyPrefix: "s3-poc" }

// The AWS SDK itself is not under test here - only who may call what, and where the file ends up
const s3 = vi.hoisted(() => ({
	getS3PocConfig: vi.fn(),
	uploadObject: vi.fn(),
	listUserObjects: vi.fn()
}))
vi.mock("$lib/server/s3/s3-poc", () => s3)

const ADMIN_ID = "admin-oid-5678"

type CallOptions = { method?: string; rawBody?: BodyInit; headers?: Record<string, string>; user?: keyof typeof TEST_USER_MS_HEADERS }

const makeEvent = (path: string, { method = "GET", rawBody, headers = {}, user = "admin" }: CallOptions = {}): RequestEvent => {
	const request = new Request(`http://hugin.test${path}`, {
		method,
		headers: { [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS[user], ...headers },
		...(rawBody !== undefined ? { body: rawBody } : {})
	})
	return { request, params: {}, url: new URL(request.url) } as unknown as RequestEvent
}

// The arguments of the nth call to the mocked upload (fails loudly if it was never called)
const uploadCall = (index = 0) => {
	const call = s3.uploadObject.mock.calls[index]
	if (!call) throw new Error(`uploadObject was not called ${index + 1} time(s)`)
	return { config: call[0] as S3PocConfig, params: call[1] as { key: string; contentType: string; metadata: Record<string, string> } }
}

const put = (name: string | null, options: CallOptions = {}) =>
	PUT(makeEvent(`/api/s3-poc${name === null ? "" : `?name=${encodeURIComponent(name)}`}`, { method: "PUT", rawBody: new Uint8Array(10), ...options }))

beforeEach(() => {
	s3.getS3PocConfig.mockReset().mockReturnValue(CONFIG)
	s3.uploadObject.mockReset().mockImplementation(async (_config: S3PocConfig, params: { body: ReadableStream }) => {
		// Drain the body like the real upload does, so the byte limit is exercised
		await new Response(params.body).arrayBuffer()
	})
	s3.listUserObjects.mockReset().mockResolvedValue([])
})

describe("access control", () => {
	it("denies a non-admin on the API and the page, without touching S3", async () => {
		expect((await GET(makeEvent("/api/s3-poc", { user: "employee" }))).status).toBe(403)
		expect((await put("a.pdf", { user: "employee" })).status).toBe(403)
		expect((await GET(makeEvent("/api/s3-poc", { user: "student" }))).status).toBe(403)
		await expect(pageLoad(makeEvent("/s3-poc", { user: "employee" }) as never)).rejects.toMatchObject({ status: 403 })
		expect(s3.listUserObjects).not.toHaveBeenCalled()
		expect(s3.uploadObject).not.toHaveBeenCalled()
	})

	it("answers a non-admin 403 even while the feature is switched off", async () => {
		s3.getS3PocConfig.mockReturnValue(null)
		expect((await GET(makeEvent("/api/s3-poc", { user: "employee" }))).status).toBe(403)
	})

	it("answers an admin 404 while the feature is switched off", async () => {
		s3.getS3PocConfig.mockReturnValue(null)
		expect((await GET(makeEvent("/api/s3-poc"))).status).toBe(404)
		expect((await put("a.pdf")).status).toBe(404)
		await expect(pageLoad(makeEvent("/s3-poc") as never)).rejects.toMatchObject({ status: 404 })
	})
})

describe("GET /api/s3-poc", () => {
	it("lists only the caller's own prefix", async () => {
		const objects = [{ key: `s3-poc/${ADMIN_ID}/u1-a.pdf`, fileName: "u1-a.pdf", size: 10, lastModified: null }]
		s3.listUserObjects.mockResolvedValue(objects)
		const res = await GET(makeEvent("/api/s3-poc"))
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ objects })
		expect(s3.listUserObjects).toHaveBeenCalledWith(CONFIG, ADMIN_ID)
	})

	it("answers 502 when S3 can't be reached", async () => {
		s3.listUserObjects.mockRejectedValue(new Error("connect ECONNREFUSED"))
		expect((await GET(makeEvent("/api/s3-poc"))).status).toBe(502)
	})
})

describe("PUT /api/s3-poc", () => {
	it("stores the file under the caller's own prefix with a sanitized name", async () => {
		const res = await put("../../other-user/rapport.pdf", { headers: { "content-type": "application/pdf" } })
		expect(res.status).toBe(201)
		const { config, params } = uploadCall()
		expect(config).toBe(CONFIG)
		expect(params.key).toMatch(new RegExp(`^s3-poc/${ADMIN_ID}/[0-9a-f-]{36}-rapport\\.pdf$`))
		expect(params.contentType).toBe("application/pdf")
		expect(params.metadata).toEqual({ "uploaded-by": ADMIN_ID, "original-name": encodeURIComponent("../../other-user/rapport.pdf") })
		expect(await res.json()).toMatchObject({ object: { key: params.key, fileName: "rapport.pdf" } })
	})

	it("stores the type declared in the query, whatever Content-Type the request carries", async () => {
		// The browser sends application/octet-stream because the WAF in front of Hugin blocks media Content-Types
		const res = await PUT(makeEvent("/api/s3-poc?name=diagram.png&type=image%2Fpng", { method: "PUT", rawBody: new Uint8Array(10), headers: { "content-type": "application/octet-stream" } }))
		expect(res.status).toBe(201)
		expect(uploadCall().params.contentType).toBe("image/png")
	})

	it("falls back to octet-stream when the declared type is not a plain media type", async () => {
		const res = await PUT(makeEvent("/api/s3-poc?name=a.bin&type=not%20a%20type", { method: "PUT", rawBody: new Uint8Array(10) }))
		expect(res.status).toBe(201)
		expect(uploadCall().params.contentType).toBe("application/octet-stream")
	})

	it("gives every upload of the same name its own key", async () => {
		await put("a.pdf")
		await put("a.pdf")
		expect(uploadCall(0).params.key).not.toBe(uploadCall(1).params.key)
	})

	it.each([
		["missing", null],
		["empty", ""],
		["too long", "a".repeat(256)]
	])("rejects a %s file name", async (_label, name) => {
		expect((await put(name)).status).toBe(400)
		expect(s3.uploadObject).not.toHaveBeenCalled()
	})

	it("rejects a declared size over the limit before reading the body", async () => {
		const res = await put("big.bin", { headers: { "content-length": String(501 * 1024 * 1024) } })
		expect(res.status).toBe(413)
		expect(s3.uploadObject).not.toHaveBeenCalled()
	})

	it("stops a body that exceeds the limit without a Content-Length", async () => {
		s3.uploadObject.mockImplementation(async (_config: S3PocConfig, params: { body: ReadableStream }) => {
			await new Response(params.body).arrayBuffer()
		})
		const oversized = new ReadableStream<Uint8Array>({
			pull(controller) {
				controller.enqueue(new Uint8Array(64 * 1024 * 1024))
			}
		})
		const request = new Request("http://hugin.test/api/s3-poc?name=big.bin", {
			method: "PUT",
			headers: { [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin },
			body: oversized,
			// @ts-expect-error - required in Node to stream a request body
			duplex: "half"
		})
		const res = await PUT({ request, params: {}, url: new URL(request.url) } as unknown as RequestEvent)
		expect(res.status).toBe(413)
	})

	it("answers 502 when the upload to S3 fails", async () => {
		s3.uploadObject.mockRejectedValue(new Error("connect ECONNREFUSED"))
		const res = await put("a.pdf")
		expect(res.status).toBe(502)
		expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED")
	})
})

describe("page load", () => {
	it("shows the connection problem instead of an error page when listing fails", async () => {
		s3.listUserObjects.mockRejectedValue(new Error("connect ECONNREFUSED"))
		const data = (await pageLoad(makeEvent("/s3-poc") as never)) as { listError: string | null; bucket: string; objects: unknown[] }
		expect(data.listError).toBeTruthy()
		expect(data.bucket).toBe("hugin-poc")
		expect(data.objects).toEqual([])
	})
})
