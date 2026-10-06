import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { assertModelConfig } from "$lib/server/models/assert-model-config"
import { deriveVendorModels } from "$lib/server/models/derive-vendors"
import { MODEL_CONFIG } from "$lib/server/models/models.config"
import { buildClientProfiles, type ModelContext, resolveDefaultProfileId } from "$lib/server/models/resolve"
import type { AppConfig } from "$lib/types/app-config"

assertModelConfig(MODEL_CONFIG)

const VENDORS: AppConfig["VENDORS"] = {
	MISTRAL: {
		NAME: "Mistral",
		ENABLED: Boolean(env.MISTRAL_API_KEY_PROJECT_DEFAULT),
		PROJECTS: Object.keys(env)
			.filter((key) => key.startsWith("MISTRAL_API_KEY_PROJECT"))
			.map((key) => key.replace("MISTRAL_API_KEY_PROJECT_", "")),
		MODELS: deriveVendorModels(MODEL_CONFIG, "MISTRAL")
	},
	OPENAI: {
		NAME: "OpenAI",
		ENABLED: Boolean(env.OPENAI_API_KEY_PROJECT_DEFAULT),
		PROJECTS: Object.keys(env)
			.filter((key) => key.startsWith("OPENAI_API_KEY_PROJECT"))
			.map((key) => key.replace("OPENAI_API_KEY_PROJECT_", "")),
		MODELS: deriveVendorModels(MODEL_CONFIG, "OPENAI")
	},
	OLLAMA: {
		NAME: "Ollama",
		ENABLED: Boolean(env.OLLAMA_HOST),
		PROJECTS: ["DEFAULT"],
		MODELS: deriveVendorModels(MODEL_CONFIG, "OLLAMA")
	},
	LITELLM: {
		NAME: "Telemark fylkeskommune",
		ENABLED: Boolean(env.LITELLM_BASE_URL),
		PROJECTS: ["DEFAULT"],
		MODELS: deriveVendorModels(MODEL_CONFIG, "LITELLM")
	}
}

export const MODEL_CONTEXT: ModelContext = {
	modelConfig: MODEL_CONFIG,
	// Stored configs from early versions can carry lowercase/unknown vendor ids - never index VENDORS blindly
	isVendorEnabled: (vendorId) => Object.hasOwn(VENDORS, vendorId) && VENDORS[vendorId].ENABLED,
	vendorProjects: (vendorId) => (Object.hasOwn(VENDORS, vendorId) ? VENDORS[vendorId].PROJECTS : [])
}

for (const profile of MODEL_CONFIG.PROFILES) {
	const model = MODEL_CONFIG.MODELS[profile.model]
	if (model && !VENDORS[model.vendor].ENABLED) {
		logger.warn("Model profile {profileId} is hidden: vendor {vendorId} is not enabled", profile.id, model.vendor)
	}
}

const DEFAULT_CHAT_PROFILE_ID = resolveDefaultProfileId("chat", MODEL_CONTEXT)
const DEFAULT_ASSISTANT_PROFILE_ID = resolveDefaultProfileId("assistant", MODEL_CONTEXT)
if (!DEFAULT_CHAT_PROFILE_ID || !DEFAULT_ASSISTANT_PROFILE_ID) {
	logger.error("No usable model profile - every profile's vendor is disabled. Check models.config.ts and vendor API keys")
}

export const APP_CONFIG: AppConfig = {
	NAME: env.APP_NAME || "Mugin",
	BODY_SIZE_LIMIT_BYTES: env.BODY_SIZE_LIMIT?.endsWith("M") ? Number(env.BODY_SIZE_LIMIT.split("M")[0]) * 1024 * 1024 : 10 * 1024 * 1024,
	APP_ROLES: {
		ADMIN: env.APP_ROLE_ADMIN as string,
		AGENT_MAINTAINER: env.APP_ROLE_AGENT_MAINTAINER as string,
		EMPLOYEE: env.APP_ROLE_EMPLOYEE as string,
		STUDENT: env.APP_ROLE_STUDENT as string,
		EDU_EMPLOYEE: env.APP_ROLE_EDU_EMPLOYEE || "eduemployee",
		QA: env.APP_ROLE_QA || "QA"
	},
	CONVERSATION_EXPORT_DISABLED: env.CONVERSATION_EXPORT_DISABLED === "true",
	NEW_CHAT_CONFIRM_DISABLED: env.NEW_CHAT_CONFIRM_DISABLED === "true",
	CANVAS_ENABLED: env.CANVAS_ENABLED === "true",
	TRANSCRIPTION_GREEN_GROUP_ID: env.TRANSCRIPTION_GREEN_ID,
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
	VENDORS,
	MODEL_PROFILES: buildClientProfiles(MODEL_CONTEXT),
	DEFAULT_PROFILE_IDS: { CHAT: DEFAULT_CHAT_PROFILE_ID ?? "", ASSISTANT: DEFAULT_ASSISTANT_PROFILE_ID ?? "" }
}
