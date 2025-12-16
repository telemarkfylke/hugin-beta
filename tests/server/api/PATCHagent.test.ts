import type { RequestEvent } from "@sveltejs/kit"
import { describe, expect, it } from "vitest"
import { MS_AUTH_PRINCIPAL_CLAIMS_HEADER } from "$lib/server/auth/auth-constants"
import type { Agent, DBAgentPatchInput } from "$lib/types/agents"
import { PATCH } from "../../../src/routes/api/agents/[agentId]/+server"
import { TEST_USER_MS_HEADERS, type TestRequestEvent } from "./test-requests-data"

const validAgentUpdateInput: DBAgentPatchInput = {
	name: "Oppdatert Test Agent",
	description: "Dette er en oppdatert test agent",
	config: {
		type: "manual",
		model: "gpt-4o",
		instructions: ["Oppdatert instruksjon"],
		messageFilesEnabled: false,
		vectorStoreEnabled: false,
		vectorStoreIds: [],
		webSearchEnabled: true
	},
	authorizedGroupIds: "all"
}

const notSupportedModelAgentUpdateInput: DBAgentPatchInput = {
	config: {
		type: "manual",
		model: "fjert-model-9000"
	}
}

// This only tests mock data, so not actually a useful test in itself, just an example
describe("server route PATCH api/agents/[agentId]/+server", () => {
	it("returns 400 when agentInput is malformed", async () => {
		const requestEvent: TestRequestEvent = {
			params: { agentId: "test-agent-3" },
			request: new Request("http://localhost/api/agents/test-agent-3", {
				method: "PATCH",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify({ invalidField: "invalidValue" })
			})
		}
		const response = await PATCH(requestEvent as RequestEvent)
		expect(response.status).toBe(400)
	})
	it("returns 400 when agentModel is not supported by vendor", async () => {
		const requestEvent: TestRequestEvent = {
			params: { agentId: "test-agent-3" },
			request: new Request("http://localhost/api/agents/test-agent-3", {
				method: "PATCH",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify(notSupportedModelAgentUpdateInput)
			})
		}
		const response = await PATCH(requestEvent as RequestEvent)
		expect(response.status).toBe(400)
	})
	it("returns 403 when user is not allowed to edit agents", async () => {
		const requestEvent: TestRequestEvent = {
			params: { agentId: "test-agent-3" },
			request: new Request("http://localhost/api/agents/test-agent-3", {
				method: "PATCH",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.employee, "Content-Type": "application/json" }),
				body: JSON.stringify(validAgentUpdateInput)
			})
		}
		const response = await PATCH(requestEvent as RequestEvent)
		expect(response.status).toBe(403)
	})
	it("returns 200 and updated agent when user can edit agents", async () => {
		const requestEvent: TestRequestEvent = {
			params: { agentId: "test-agent-3" },
			request: new Request("http://localhost/api/agents/test-agent-3", {
				method: "PATCH",
				headers: new Headers({ [MS_AUTH_PRINCIPAL_CLAIMS_HEADER]: TEST_USER_MS_HEADERS.admin, "Content-Type": "application/json" }),
				body: JSON.stringify(validAgentUpdateInput)
			})
		}
		const response = await PATCH(requestEvent as RequestEvent)
		expect(response.status).toBe(200)
		const updatedAgentResponse = (await response.json()) as { agent: Agent }
		expect(updatedAgentResponse.agent).toBeDefined()
		expect(updatedAgentResponse.agent.name).toBe(validAgentUpdateInput.name)
		expect(updatedAgentResponse.agent.description).toBe(validAgentUpdateInput.description)
		expect(updatedAgentResponse.agent.config.type).toBe(validAgentUpdateInput.config?.type)
		if (!validAgentUpdateInput.config) {
			throw new Error("config is undefined in validAgentUpdateInput")
		}
		if (!(updatedAgentResponse.agent.config.type === "manual" && validAgentUpdateInput.config.type === "manual")) {
			throw new Error("config type mismatch between updatedAgentResponse and validAgentUpdateInput")
		}
		expect(updatedAgentResponse.agent.config.model).toBe(validAgentUpdateInput.config.model)
	})
})
