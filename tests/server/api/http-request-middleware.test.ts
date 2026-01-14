import type { RequestEvent, RequestHandler } from "@sveltejs/kit"
import { describe, expect, it } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { TEST_USER_MS_HEADERS, type TestRequestEvent } from "./test-requests-data"

const idiotNextFunction: ApiNextFunction = async () => {
	return {
		response: new Response("Hello, world!", { status: 200 }),
		isAuthorized: true
	}
}

const idiotNextThrowHTTPFunction: ApiNextFunction = async () => {
	throw new HTTPError(418, "I'm a teapot")
}

const idiotNextThrowFunction: ApiNextFunction = async () => {
	throw new Error("Some unexpected error")
}

const idiotNotAuthorizedFunction: ApiNextFunction = async () => {
	return {
		response: new Response("Hello, world!", { status: 200 }),
		isAuthorized: false
	}
}

const middlewareTester: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, idiotNextFunction)
}

describe("apiRequestMiddleware works correctly", () => {
	it("returns 401 if user is no user header is preset", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers()
			})
		}
		const response = await middlewareTester(requestEvent as RequestEvent)
		expect(response.status).toBe(401)
		const data = await response.json()
		expect(data.message).toBe("Unauthorized")
	})
	it("returns 403 if user if next function does not return authorized true", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee })
			})
		}
		const response = await apiRequestMiddleware(requestEvent as RequestEvent, idiotNotAuthorizedFunction)
		expect(response.status).toBe(403)
		const data = await response.json()
		expect(data.message).toBe("Forbidden")
	})
	it("returns 401 if user have weird claims", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: "fdhjfkdhkjfsd" })
			})
		}
		const response = await apiRequestMiddleware(requestEvent as RequestEvent, idiotNotAuthorizedFunction)
		expect(response.status).toBe(401)
		const data = await response.json()
		expect(data.message).toBe("Unauthorized")
	})
	it("returns 200 if user is authenticated and authorized", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee })
			})
		}
		const response = await middlewareTester(requestEvent as RequestEvent)
		expect(response.status).toBe(200)
		const data = await response.text()
		expect(data).toBe("Hello, world!")
	})
	it("returns proper HTTP error if next function throws HTTPError", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee })
			})
		}
		const response = await apiRequestMiddleware(requestEvent as RequestEvent, idiotNextThrowHTTPFunction)
		expect(response.status).toBe(418)
		const data = await response.json()
		expect(data.message).toBe("I'm a teapot")
	})
	it("returns 500 error if next function throws unexpected error", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/hvorsomhelst", {
				method: "GET",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee })
			})
		}
		const response = await apiRequestMiddleware(requestEvent as RequestEvent, idiotNextThrowFunction)
		expect(response.status).toBe(500)
		const data = await response.json()
		expect(data.message).toBe("Internal Server Error")
	})
})
