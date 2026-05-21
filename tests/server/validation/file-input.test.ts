import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatRequest } from "$lib/types/chat"
import { validateFileInputs } from "$lib/validation/file-input"

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

const request = (fileUrl: string): ChatRequest => ({
	config: {
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
	},
	inputs: [
		{
			type: "message.input",
			role: "user",
			content: [
				{ type: "input_text", text: "Hello" },
				{ type: "input_file", fileName: "file.pdf", fileUrl }
			]
		}
	],
	stream: true
})

describe("validateFileInputs", () => {
	it("accepts configured MIME types", () => {
		const chatRequest = request("data:application/pdf;base64,Zm9v")

		expect(() => validateFileInputs(chatRequest, appConfig)).not.toThrow()
	})

	it("rejects unsupported MIME types", () => {
		const chatRequest = request("data:text/html;base64,PGgxPkhlbGxvPC9oMT4=")

		expect(() => validateFileInputs(chatRequest, appConfig)).toThrow(HTTPError)
	})

	it("removes unsupported previous file inputs", () => {
		const chatRequest = request("data:application/pdf;base64,Zm9v")
		chatRequest.inputs.unshift({
			type: "message.input",
			role: "user",
			content: [
				{ type: "input_file", fileName: "old.html", fileUrl: "data:text/html;base64,PGgxPkhlbGxvPC9oMT4=" },
				{ type: "input_text", text: "Keep me" }
			]
		})

		validateFileInputs(chatRequest, appConfig)

		expect(chatRequest.inputs[0]).toEqual({ type: "message.input", role: "user", content: [{ type: "input_text", text: "Keep me" }] })
	})
})
