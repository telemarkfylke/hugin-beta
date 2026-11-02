import { logger } from "@vestfoldfylke/loglady"
import type { Message, ChatRequest as OllamaChatRequest } from "ollama"
import { Ollama } from "ollama"
import { env } from "$env/dynamic/private"
import type { IAIVendor } from "$lib/types/AIVendor"
import type { ChatRequest, ChatResponseObject, ChatResponseStream } from "$lib/types/chat"
import { classifyOllamaError } from "./ollama-diagnostics"
import { buildOllamaHeaders } from "./ollama-headers"
import { chatInputToOllamaMessage, ollamaResponseToChatResponseObject } from "./ollama-mapping"
import { handleOllamaChatStream } from "./ollama-stream"

const LOG_PREFIX = "[ollama]"

const getOllamaHost = (): string => {
	if (!env.OLLAMA_HOST) {
		throw new Error("OLLAMA_HOST environment variable is not set")
	}
	return `${env.OLLAMA_HOST}`
}

const createOllamaClient = (): Ollama => new Ollama({ host: getOllamaHost(), headers: buildOllamaHeaders(env.OLLAMA_BASIC_AUTH) })

const buildOllamaRequest = (chatRequest: ChatRequest): Omit<OllamaChatRequest, "stream"> => {
	if (!chatRequest.config.model) {
		throw new Error("Model is required for Ollama vendor")
	}

	const messages: Message[] = chatRequest.inputs.map(chatInputToOllamaMessage)

	if (chatRequest.config.instructions) {
		messages.unshift({ role: "system", content: chatRequest.config.instructions })
	}

	return {
		model: chatRequest.config.model,
		messages
	}
}

// Only the host, model, counts and timings are logged - never prompts, responses or credentials.
const logFailure = (error: unknown, model: string | undefined, stream: boolean, startedAt: number): void => {
	const { kind, status, code } = classifyOllamaError(error)
	logger.errorException(
		error,
		`${LOG_PREFIX} Request failed (kind: {kind}, status: {status}, code: {code}, model: {model}, stream: {stream}, host: {host}, after {durationMs} ms)`,
		kind,
		status ?? "none",
		code ?? "none",
		model ?? "none",
		stream,
		env.OLLAMA_HOST ?? "unset",
		Date.now() - startedAt
	)
}

export class OllamaAIVendor implements IAIVendor {
	public async createChatResponse(chatRequest: ChatRequest): Promise<ChatResponseObject> {
		const startedAt = Date.now()
		const { model } = chatRequest.config
		logger.info(`${LOG_PREFIX} Chat request (model: {model}, messages: {messages}, stream: false)`, model ?? "none", chatRequest.inputs.length)
		try {
			const response = await createOllamaClient().chat({
				...buildOllamaRequest(chatRequest),
				stream: false
			})
			logger.info(
				`${LOG_PREFIX} Chat response (model: {model}, inputTokens: {inputTokens}, outputTokens: {outputTokens}, {durationMs} ms)`,
				model ?? "none",
				response.prompt_eval_count ?? 0,
				response.eval_count ?? 0,
				Date.now() - startedAt
			)
			return ollamaResponseToChatResponseObject(chatRequest.config, response, crypto.randomUUID())
		} catch (error) {
			logFailure(error, model, false, startedAt)
			throw error
		}
	}

	public async createChatResponseStream(chatRequest: ChatRequest): Promise<ChatResponseStream> {
		const startedAt = Date.now()
		const { model } = chatRequest.config
		logger.info(`${LOG_PREFIX} Chat request (model: {model}, messages: {messages}, stream: true)`, model ?? "none", chatRequest.inputs.length)
		try {
			const responseStream = await createOllamaClient().chat({
				...buildOllamaRequest(chatRequest),
				stream: true
			})
			logger.info(`${LOG_PREFIX} Connected, streaming (model: {model}, {durationMs} ms to first response)`, model ?? "none", Date.now() - startedAt)
			return handleOllamaChatStream(chatRequest, responseStream)
		} catch (error) {
			logFailure(error, model, true, startedAt)
			throw error
		}
	}
}
