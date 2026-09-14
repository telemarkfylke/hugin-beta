import type { RequestEvent } from "@sveltejs/kit"
import { describe, expect, it } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { POST } from "../../../src/routes/api/canvas/presentation/export/+server"
import { TEST_USER_MS_HEADERS, type TestRequestEvent } from "../api/test-requests-data"

const requestWithHeaders = (headers: Headers, body: unknown): RequestEvent => {
	const requestEvent: TestRequestEvent = {
		params: {},
		request: new Request("http://localhost/api/canvas/presentation/export", {
			method: "POST",
			headers,
			body: JSON.stringify(body)
		})
	}
	return requestEvent as RequestEvent
}

const employeeHeaders = () => new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee, "Content-Type": "application/json" })

describe("POST /api/canvas/presentation/export", () => {
	it("returns a pptx binary with the correct headers for valid slides", async () => {
		const response = await POST(requestWithHeaders(employeeHeaders(), { slides: "# Velkommen\n- Punkt en\n---\n## Slide 2\n- Punkt to" }))

		expect(response.status).toBe(200)
		expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation")
		expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="presentasjon.pptx"')
		const buffer = Buffer.from(await response.arrayBuffer())
		expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK")
	})

	it("returns 400 when slides is empty", async () => {
		const response = await POST(requestWithHeaders(employeeHeaders(), { slides: "" }))
		expect(response.status).toBe(400)
	})

	it("returns 400 when slides is missing from the body", async () => {
		const response = await POST(requestWithHeaders(employeeHeaders(), {}))
		expect(response.status).toBe(400)
	})

	it("returns 401 when there is no authenticated user", async () => {
		const response = await POST(requestWithHeaders(new Headers({ "Content-Type": "application/json" }), { slides: "# Title" }))
		expect(response.status).toBe(401)
	})
})
