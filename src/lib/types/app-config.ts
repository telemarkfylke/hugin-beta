import type { ClientModelProfile, MimeTypes, ModelCapability } from "./model-profiles"

export type ModelInfo = {
	// Catalogue key in $lib/server/models/models.config.ts - what ChatConfig.pinned.model refers to
	KEY: string
	// Provider model ID - what ChatConfig.model holds after resolution
	ID: string
	SUPPORTED_MESSAGE_FILE_MIME_TYPES: MimeTypes
	CAPABILITIES: ModelCapability[]
	RETIRED: boolean
}

export type VendorInfo = {
	NAME: string
	ENABLED: boolean
	PROJECTS: string[]
	MODELS: ModelInfo[]
}

export type AppRoles = {
	ADMIN: string
	AGENT_MAINTAINER: string
	EMPLOYEE: string
	STUDENT: string
	EDU_EMPLOYEE: string
	// Grants the "Opplev Hugin som" role switcher (see $lib/role-preview) - assign in test environments only
	QA: string
}

export type TranscriptionGroup = {
	id: string
	label: string
}

export type AppConfig = {
	NAME: string
	BODY_SIZE_LIMIT_BYTES: number
	APP_ROLES: AppRoles
	CONVERSATION_EXPORT_DISABLED: boolean
	NEW_CHAT_CONFIRM_DISABLED: boolean
	CANVAS_ENABLED: boolean
	TRANSCRIPTION_GREEN_GROUP_ID: string | undefined
	TRANSCRIPTION_GROUPS: TranscriptionGroup[]
	// Profiles whose vendor is enabled - the picker filters by role client-side, the server enforces on save
	MODEL_PROFILES: ClientModelProfile[]
	// Resolved default profile ids ("" only if no profile is usable at all - logged at startup)
	DEFAULT_PROFILE_IDS: { CHAT: string; ASSISTANT: string }
	VENDORS: {
		MISTRAL: VendorInfo
		OPENAI: VendorInfo
		OLLAMA: VendorInfo
		LITELLM: VendorInfo
	}
}
