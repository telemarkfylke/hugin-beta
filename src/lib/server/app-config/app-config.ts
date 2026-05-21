import { env } from "$env/dynamic/private"
import type { AppConfig } from "$lib/types/app-config"
import { assertMockAuthAllowed, parseAppRoles } from "$lib/validation/env"
import {
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
} from "./supported-mime-types"

const DEFAULT_BODY_SIZE_LIMIT_BYTES = 10 * 1024 * 1024

export const parseBodySizeLimitBytes = (value: string | undefined, defaultValue = DEFAULT_BODY_SIZE_LIMIT_BYTES): number => {
	if (!value) {
		return defaultValue
	}
	const trimmed = value.trim().toUpperCase()
	const megabyteMatch = trimmed.match(/^(\d+)\s*M(B)?$/)
	if (megabyteMatch?.[1]) {
		return Number(megabyteMatch[1]) * 1024 * 1024
	}
	const bytes = Number(trimmed)
	if (Number.isInteger(bytes) && bytes > 0) {
		return bytes
	}
	return defaultValue
}

assertMockAuthAllowed(env)

export const APP_CONFIG: AppConfig = {
	NAME: env.APP_NAME || "Mugin",
	BODY_SIZE_LIMIT_BYTES: parseBodySizeLimitBytes(env.BODY_SIZE_LIMIT),
	APP_ROLES: parseAppRoles(env),
	CONVERSATION_EXPORT_DISABLED: env.CONVERSATION_EXPORT_DISABLED === "true",
	NEW_CHAT_CONFIRM_DISABLED: env.NEW_CHAT_CONFIRM_DISABLED === "true",
	VENDORS: {
		MISTRAL: {
			NAME: "Mistral",
			ENABLED: Boolean(env.MISTRAL_API_KEY_PROJECT_DEFAULT),
			PROJECTS: Object.keys(env)
				.filter((key) => key.startsWith("MISTRAL_API_KEY_PROJECT"))
				.map((key) => key.replace("MISTRAL_API_KEY_PROJECT_", "")),
			MODELS: [
				{
					ID: "mistral-medium-latest",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "mistral-large-latest",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				}
			]
		},
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: Boolean(env.OPENAI_API_KEY_PROJECT_DEFAULT),
			PROJECTS: Object.keys(env)
				.filter((key) => key.startsWith("OPENAI_API_KEY_PROJECT"))
				.map((key) => key.replace("OPENAI_API_KEY_PROJECT_", "")),
			MODELS: [
				{
					ID: "gpt-4o",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "gpt-4",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "gpt-4.1",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "gpt-5.2",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "gpt-5.4",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				},
				{
					ID: "gpt-5.5",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
						IMAGE: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
					}
				}
			]
		},
		OLLAMA: {
			NAME: "Ollama",
			ENABLED: Boolean(env.OLLAMA_HOST),
			PROJECTS: ["DEFAULT"],
			MODELS: [
				{
					ID: "llama3:8b",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: [],
						IMAGE: []
					}
				},
				{
					ID: "LTG/normistral-11b-thinking:latest",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
						FILE: [],
						IMAGE: []
					}
				}
			]
		},
		LITELLM: {
			NAME: "Telemark fylkeskommune",
			ENABLED: Boolean(env.LITELLM_BASE_URL),
			PROJECTS: ["DEFAULT"],
			MODELS: [
				{
					ID: "norallm/normistral-11b-thinking",
					SUPPORTED_MESSAGE_FILE_MIME_TYPES: { FILE: [], IMAGE: [] }
				}
			]
		}
	}
}
