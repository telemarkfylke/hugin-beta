export type ModelInfo = {
	ID: string
	SUPPORTED_MESSAGE_FILE_MIME_TYPES: {
		FILE: string[]
		IMAGE: string[]
	}
}

export type VendorInfo = {
	ID: string
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
}

export type AppConfig = {
	NAME: string
	APP_ROLES: AppRoles
	VENDORS: {
		MISTRAL: VendorInfo
		OPENAI: VendorInfo
		OLLAMA: VendorInfo
	}
}
