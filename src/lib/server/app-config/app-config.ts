import { env } from "$env/dynamic/private"
import type { AppConfig } from "$lib/types/app-config"
import {
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
	OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
} from "./supported-mime-types"

export const APP_CONFIG: AppConfig = {
	NAME: env.APP_NAME || "Mugin",
	APP_ROLES: {
		ADMIN: env.APP_ROLE_ADMIN,
		AGENT_MAINTAINER: env.APP_ROLE_AGENT_MAINTAINER,
		EMPLOYEE: env.APP_ROLE_EMPLOYEE,
		STUDENT: env.APP_ROLE_STUDENT
	},
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
				}
			]
		},
		OLLAMA: {
			NAME: "Ollama",
			ENABLED: Boolean(env.OLLAMA_API_KEY),
			PROJECTS: Object.keys(env)
				.filter((key) => key.startsWith("OLLAMA_API_KEY_PROJECT"))
				.map((key) => key.replace("OLLAMA_API_KEY_PROJECT_", "")),
			MODELS: []
		}
	}
}
