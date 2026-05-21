import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatConfig } from "$lib/types/chat"
import { parseChatRequest } from "$lib/validation/parse-chat-request"

const appConfig: AppConfig = {
	NAME: "Hugin test",
	BODY_SIZE_LIMIT_BYTES: 1024 * 1024,
	APP_ROLES: { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "EduEmployee" },
	CONVERSATION_EXPORT_DISABLED: false,
	NEW_CHAT_CONFIRM_DISABLED: false,
	VENDORS: {
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: true,
			PROJECTS: ["DEFAULT"],
			MODELS: [{ ID: "gpt-4.1", SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: ["application/pdf"], IMAGE: ["image/png"] } }]
		},
		MISTRAL: { NAME: "Mistral", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] },
		OLLAMA: { NAME: "Ollama", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] },
		LITELLM: { NAME: "LiteLLM", ENABLED: false, PROJECTS: ["DEFAULT"], MODELS: [] }
	}
}

const config: ChatConfig = {
	_id: "config-1",
	name: "Config",
	description: "Description",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: ["all"],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1" } }
}

describe("parseChatRequest", () => {
	it("parses valid chat requests", () => {
		expect(
			parseChatRequest(
				{
					config,
					inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "Hello" }] }],
					stream: true
				},
				appConfig
			)
		).toEqual({
			config: { ...config, tools: [] },
			inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text", text: "Hello" }] }],
			stream: true,
			store: false
		})
	})

	it("rejects empty inputs", () => {
		expect(() => parseChatRequest({ config, inputs: [] }, appConfig)).toThrow(HTTPError)
	})

	it("rejects invalid input item content", () => {
		expect(() => parseChatRequest({ config, inputs: [{ type: "message.input", role: "user", content: [{ type: "input_text" }] }] }, appConfig)).toThrow(HTTPError)
	})

	it("rejects unsupported file MIME types for manual configs", () => {
		expect(() =>
			parseChatRequest(
				{ config, inputs: [{ type: "message.input", role: "user", content: [{ type: "input_file", fileName: "bad.html", fileUrl: "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=" }] }] },
				appConfig
			)
		).toThrow(HTTPError)
	})

	it("accepts previous assistant messages", () => {
		expect(
			parseChatRequest(
				{
					config,
					inputs: [
						{ id: "output-1", type: "message.output", role: "assistant", content: [{ type: "output_text", text: "Hi" }] },
						{ type: "message.input", role: "user", content: [{ type: "input_text", text: "Hello" }] }
					]
				},
				appConfig
			).inputs[0]
		).toEqual({ id: "output-1", type: "message.output", role: "assistant", content: [{ type: "output_text", text: "Hi" }] })
	})
})
