import { createMistral } from "@ai-sdk/mistral"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { env } from "$env/dynamic/private"
import { HTTPError } from "$lib/server/middleware/http-error"
import type { ChatConfig } from "$lib/types/chat"

const getApiKey = (prefix: string, project: string): string => {
	const key = env[`${prefix}_API_KEY_PROJECT_${project}`]
	if (!key) {
		throw new HTTPError(500, `Missing API key: ${prefix}_API_KEY_PROJECT_${project}`)
	}
	return key
}

export const resolveModel = (config: ChatConfig): LanguageModel => {
	switch (config.vendorId) {
		case "OPENAI": {
			const openai = createOpenAI({ apiKey: getApiKey("OPENAI", config.project) })
			return openai(config.model ?? "gpt-4o")
		}
		case "MISTRAL": {
			const mistral = createMistral({ apiKey: getApiKey("MISTRAL", config.project) })
			return mistral(config.model ?? "mistral-large-latest")
		}
		default:
			throw new HTTPError(400, `Unsupported vendorId: ${config.vendorId}`)
	}
}
