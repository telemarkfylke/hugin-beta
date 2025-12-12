import type { RequestEvent } from "@sveltejs/kit"
import { describe, expect, it } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import { POST } from "../../../src/routes/api/agents/+server"
import { TEST_USER_MS_HEADERS, type TestRequestEvent } from "./test-requests-data"
import type { DBAgentInput } from "$lib/types/agents"

const validAgentInput: DBAgentInput = {
	name: "Test Agent",
	vendorId: "openai",
	description: "This is a test agent",
	config: {
		type: "manual",
		model: "gpt-4o",
		instructions: ["You are a helpful assistant."],
		messageFilesEnabled: false,
		vectorStoreEnabled: false,
		vectorStoreIds: [],
		webSearchEnabled: false
	},
	authorizedGroupIds: "all"
}

const notSupportedModelAgentInput: DBAgentInput = {
	name: "Test Agent",
	vendorId: "openai",
	description: "This is a test agent",
	config: {
		type: "manual",
		model: "fjert-model-9000",
		instructions: ["You are a helpful assistant."],
		messageFilesEnabled: false,
		vectorStoreEnabled: false,
		vectorStoreIds: [],
		webSearchEnabled: false
	},
	authorizedGroupIds: "all"
}

// This only tests mock data, so not actually a useful test in itself, just an example
describe("server route GET api/agents/[agentId]/+server", () => {
	it("returns 400 when agentInput is malformed", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/agents", {
				method: "POST",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify({ invalidField: "invalidValue" })
			})
		}
		const response = await POST(requestEvent as RequestEvent)
		expect(response.status).toBe(400)
		const data = await response.json()
		expect(data.data).toBeDefined()
		expect(data.data).not.toBeNull()
	})
	it("returns 400 when agentModel is not supported by vendor", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/agents", {
				method: "POST",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify(notSupportedModelAgentInput)
			})
		}
		const response = await POST(requestEvent as RequestEvent)
		expect(response.status).toBe(400)
	})
	it("returns 403 when user is not allowed to create agents", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/agents", {
				method: "POST",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee, "Content-Type": "application/json" }),
				body: JSON.stringify(validAgentInput)
			})
		}
		const response = await POST(requestEvent as RequestEvent)
		expect(response.status).toBe(403)
	})
	it("returns 201 and agent when user can create agents", async () => {
		const requestEvent: TestRequestEvent = {
			params: {},
			request: new Request("http://localhost/api/agents", {
				method: "POST",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify(validAgentInput)
			})
		}
		const response = await POST(requestEvent as RequestEvent)
		expect(response.status).toBe(201)
	})
})
