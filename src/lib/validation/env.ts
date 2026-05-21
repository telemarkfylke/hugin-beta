import type { AppRoles } from "$lib/types/app-config"

type EnvLike = Record<string, string | undefined>

export class EnvValidationError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "EnvValidationError"
	}
}

const requiredEnv = (env: EnvLike, key: string): string => {
	const value = env[key]
	if (!value) {
		throw new EnvValidationError(`${key} is required`)
	}
	return value
}

export const parseAppRoles = (env: EnvLike): AppRoles => ({
	ADMIN: requiredEnv(env, "APP_ROLE_ADMIN"),
	AGENT_MAINTAINER: requiredEnv(env, "APP_ROLE_AGENT_MAINTAINER"),
	EMPLOYEE: requiredEnv(env, "APP_ROLE_EMPLOYEE"),
	STUDENT: requiredEnv(env, "APP_ROLE_STUDENT"),
	EDU_EMPLOYEE: env.APP_ROLE_EDU_EMPLOYEE || "eduemployee"
})

export const assertMockAuthAllowed = (env: EnvLike): void => {
	if (env.MOCK_AUTH !== "true") {
		return
	}
	const nodeEnv = env.NODE_ENV
	const testMode = env.TEST_MODE === "true"
	const buildPlaceholderConfig = env.BUILD_PLACEHOLDER_CONFIG === "true"
	if (nodeEnv === "production" && !testMode && !buildPlaceholderConfig) {
		throw new EnvValidationError("MOCK_AUTH must not be enabled in production")
	}
}
