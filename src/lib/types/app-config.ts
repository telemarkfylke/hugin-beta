export type VendorInfo = {
	NAME: string
	ENABLED: boolean
	PROJECTS: string[]
	SUPPORTED_MESSAGE_FILE_MIME_TYPES: string[]
	SUPPORTED_MESSAGE_IMAGE_MIME_TYPES: string[]
}

export type AppRoles = {
	ADMIN: string
	AGENT_MAINTAINER: string
	EMPLOYEE: string
	STUDENT: string
	EDU_EMPLOYEE: string
}

export type TranscriptionGroup = {
	id: string
	label: string
}

export type AppConfig = {
	NAME: string
	BODY_SIZE_LIMIT_BYTES: number
	APP_ROLES: AppRoles
	NEW_CHAT_CONFIRM_DISABLED: boolean
	TRANSCRIPTION_GROUPS: TranscriptionGroup[]
	VENDORS: {
		MISTRAL: VendorInfo
		OPENAI: VendorInfo
		OLLAMA: VendorInfo
		LITELLM: VendorInfo
	}
}
