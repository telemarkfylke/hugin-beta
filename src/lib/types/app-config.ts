export type ModelInfo = {
	ID: string
	SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
		FILE: string[]
		IMAGE: string[]
	}
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
}

export type AppConfig = {
	NAME: string
	BODY_SIZE_LIMIT_BYTES: number
	APP_ROLES: AppRoles
	CONVERSATION_EXPORT_DISABLED: boolean
	NEW_CHAT_CONFIRM_DISABLED: boolean
	VENDORS: {
		MISTRAL: VendorInfo
		OPENAI: VendorInfo
		OLLAMA: VendorInfo
		LITELLM: VendorInfo
	}
}
