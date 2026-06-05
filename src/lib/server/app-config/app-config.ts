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
	BODY_SIZE_LIMIT_BYTES: (() => {
		const val = env.BODY_SIZE_LIMIT
		if (!val) return 10 * 1024 * 1024
		if (val.endsWith("M")) return Number(val.slice(0, -1)) * 1024 * 1024
		const bytes = Number(val)
		return Number.isFinite(bytes) && bytes > 0 ? bytes : 10 * 1024 * 1024
	})(),
	APP_ROLES: {
		ADMIN: env.APP_ROLE_ADMIN as string,
		AGENT_MAINTAINER: env.APP_ROLE_AGENT_MAINTAINER as string,
		EMPLOYEE: env.APP_ROLE_EMPLOYEE as string,
		STUDENT: env.APP_ROLE_STUDENT as string,
		EDU_EMPLOYEE: env.APP_ROLE_EDU_EMPLOYEE || "eduemployee"
	},
	NEW_CHAT_CONFIRM_DISABLED: env.NEW_CHAT_CONFIRM_DISABLED === "true",
	TRANSCRIPTION_GROUPS: (() => {
		const groups = []
		let n = 1
		while (env[`TRANSCRIPTION_GROUP_${n}_ID`]) {
			groups.push({
				id: env[`TRANSCRIPTION_GROUP_${n}_ID`] as string,
				label: env[`TRANSCRIPTION_GROUP_${n}_LABEL`] ?? `Group ${n}`
			})
			n++
		}
		return groups
	})(),
	VENDORS: {
		MISTRAL: {
			NAME: "Mistral",
			ENABLED: Boolean(env.MISTRAL_API_KEY_PROJECT_DEFAULT),
			PROJECTS: Object.keys(env)
				.filter((key) => key.startsWith("MISTRAL_API_KEY_PROJECT"))
				.map((key) => key.replace("MISTRAL_API_KEY_PROJECT_", "")),
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
			SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: MISTRAL_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
		},
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: Boolean(env.OPENAI_API_KEY_PROJECT_DEFAULT),
			PROJECTS: Object.keys(env)
				.filter((key) => key.startsWith("OPENAI_API_KEY_PROJECT"))
				.map((key) => key.replace("OPENAI_API_KEY_PROJECT_", "")),
			SUPPORTED_MESSAGE_FILE_MIME_TYPES: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_FILE_MIME_TYPES,
			SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: OPEN_AI_DEFAULT_SUPPORTED_MESSAGE_IMAGE_MIME_TYPES
		},
	}
}
