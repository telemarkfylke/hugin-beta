import { describe, expect, it } from "vitest"
import { assertMockAuthAllowed, EnvValidationError, parseAppRoles } from "$lib/validation/env"

describe("parseAppRoles", () => {
	it("parses required app role environment variables", () => {
		expect(
			parseAppRoles({
				APP_ROLE_ADMIN: "Admin",
				APP_ROLE_AGENT_MAINTAINER: "AgentMaintainer",
				APP_ROLE_EMPLOYEE: "Employee",
				APP_ROLE_STUDENT: "Student",
				APP_ROLE_EDU_EMPLOYEE: "EduEmployee"
			})
		).toEqual({
			ADMIN: "Admin",
			AGENT_MAINTAINER: "AgentMaintainer",
			EMPLOYEE: "Employee",
			STUDENT: "Student",
			EDU_EMPLOYEE: "EduEmployee"
		})
	})

	it("rejects missing required app roles", () => {
		expect(() => parseAppRoles({})).toThrow(EnvValidationError)
	})
})

describe("assertMockAuthAllowed", () => {
	it("allows mock auth outside production", () => {
		expect(() => assertMockAuthAllowed({ MOCK_AUTH: "true", NODE_ENV: "development" })).not.toThrow()
	})

	it("allows mock auth in explicit test mode", () => {
		expect(() => assertMockAuthAllowed({ MOCK_AUTH: "true", NODE_ENV: "production", TEST_MODE: "true" })).not.toThrow()
	})

	it("allows mock auth for build placeholder config", () => {
		expect(() => assertMockAuthAllowed({ MOCK_AUTH: "true", NODE_ENV: "production", BUILD_PLACEHOLDER_CONFIG: "true" })).not.toThrow()
	})

	it("rejects mock auth in production", () => {
		expect(() => assertMockAuthAllowed({ MOCK_AUTH: "true", NODE_ENV: "production" })).toThrow("MOCK_AUTH must not be enabled in production")
	})
})
