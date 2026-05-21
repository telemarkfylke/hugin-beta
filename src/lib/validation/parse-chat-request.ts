import { HTTPError } from "$lib/server/middleware/http-error"
import type { AppConfig } from "$lib/types/app-config"
import type { ChatRequest } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage, ChatInputMessageContent, ChatOutputMessage, ChatOutputMessageContent } from "$lib/types/chat-item"
import { validateFileInputs } from "./file-input"
import { parseChatConfig } from "./parse-chat-config"

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const parseInputContent = (value: unknown): ChatInputMessageContent => {
	if (!isObject(value) || typeof value.type !== "string") {
		throw new HTTPError(400, "Invalid input message content")
	}
	switch (value.type) {
		case "input_text": {
			if (typeof value.text !== "string") throw new HTTPError(400, "input_text.text must be a string")
			return { type: "input_text", text: value.text }
		}
		case "input_file": {
			if (typeof value.fileName !== "string" || typeof value.fileUrl !== "string") throw new HTTPError(400, "input_file requires fileName and fileUrl strings")
			return { type: "input_file", fileName: value.fileName, fileUrl: value.fileUrl }
		}
		case "input_image": {
			if (typeof value.imageUrl !== "string") throw new HTTPError(400, "input_image.imageUrl must be a string")
			return { type: "input_image", imageUrl: value.imageUrl }
		}
		default:
			throw new HTTPError(400, `Unsupported input content type: ${value.type}`)
	}
}

const parseOutputContent = (value: unknown): ChatOutputMessageContent => {
	if (!isObject(value) || typeof value.type !== "string") {
		throw new HTTPError(400, "Invalid output message content")
	}
	switch (value.type) {
		case "output_text": {
			if (typeof value.text !== "string") throw new HTTPError(400, "output_text.text must be a string")
			return { type: "output_text", text: value.text }
		}
		case "output_refusal": {
			if (typeof value.reason !== "string") throw new HTTPError(400, "output_refusal.reason must be a string")
			return { type: "output_refusal", reason: value.reason }
		}
		default:
			throw new HTTPError(400, `Unsupported output content type: ${value.type}`)
	}
}

const parseChatInputItem = (value: unknown): ChatInputItem => {
	if (!isObject(value) || typeof value.type !== "string") {
		throw new HTTPError(400, "Invalid chat input item")
	}
	if (value.type === "message.input") {
		if (value.role !== "user" && value.role !== "developer" && value.role !== "system") {
			throw new HTTPError(400, "message.input.role must be user, developer or system")
		}
		if (!Array.isArray(value.content)) {
			throw new HTTPError(400, "message.input.content must be an array")
		}
		const message: ChatInputMessage = {
			type: "message.input",
			role: value.role,
			content: value.content.map(parseInputContent)
		}
		return message
	}
	if (value.type === "message.output") {
		if (typeof value.id !== "string") throw new HTTPError(400, "message.output.id must be a string")
		if (value.role !== "assistant") throw new HTTPError(400, "message.output.role must be assistant")
		if (!Array.isArray(value.content)) throw new HTTPError(400, "message.output.content must be an array")
		const message: ChatOutputMessage = {
			id: value.id,
			type: "message.output",
			role: "assistant",
			content: value.content.map(parseOutputContent)
		}
		return message
	}
	throw new HTTPError(400, `Unsupported chat input item type: ${value.type}`)
}

export const parseChatRequest = (body: unknown, appConfig: AppConfig): ChatRequest => {
	if (!isObject(body)) {
		throw new HTTPError(400, "Invalid chat request body")
	}

	const config = parseChatConfig(body.config, appConfig)
	if (!Array.isArray(body.inputs) || body.inputs.length === 0) {
		throw new HTTPError(400, "inputs must be a non-empty array")
	}

	const chatRequest: ChatRequest = {
		config,
		inputs: body.inputs.map(parseChatInputItem),
		stream: Boolean(body.stream),
		store: Boolean(body.store)
	}

	if (!config.vendorAgent) {
		validateFileInputs(chatRequest, appConfig)
	}

	return chatRequest
}
