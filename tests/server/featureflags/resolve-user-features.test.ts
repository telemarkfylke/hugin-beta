import { describe, expect, it } from "vitest"
import { type FeatureFlag, NO_FEATURES, resolveUserFeatures } from "../../../src/lib/featureflags/types"
import type { AppRoles } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"

const APP_ROLES: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }

const principal = (roles: string[]): AuthenticatedPrincipal => ({ userId: "u1", name: "Test", preferredUserName: "test", roles, groups: [] })

const flag = (feature: FeatureFlag["feature"], roles: FeatureFlag["roles"]): FeatureFlag => ({ feature, roles, updatedAt: null, updatedBy: null })

const flags: FeatureFlag[] = [
	flag("ragservice", { employee: true, edu_employee: false, student: false }),
	flag("transcription", { employee: true, edu_employee: true, student: false }),
	flag("canvas", { employee: false, edu_employee: false, student: true })
]

describe("resolveUserFeatures", () => {
	it("grants a feature when one of the user's roles has it", () => {
		const features = resolveUserFeatures(principal(["Employee"]), APP_ROLES, flags)
		expect(features.ragservice).toBe(true)
		expect(features.transcription).toBe(true)
		expect(features.canvas).toBe(false)
	})

	it("combines roles - a student who is also edu_employee gets what either has", () => {
		const features = resolveUserFeatures(principal(["Student", "eduemployee"]), APP_ROLES, flags)
		expect(features.transcription).toBe(true)
		expect(features.canvas).toBe(true)
		expect(features.ragservice).toBe(false)
	})

	it("gives a feature missing from the flags to nobody but admin", () => {
		expect(resolveUserFeatures(principal(["Employee", "Student", "eduemployee"]), APP_ROLES, flags).history).toBe(false)
		expect(resolveUserFeatures(principal(["Admin"]), APP_ROLES, flags).history).toBe(true)
	})

	it("gives admin everything, even with no flags loaded", () => {
		expect(Object.values(resolveUserFeatures(principal(["Admin"]), APP_ROLES, [])).every(Boolean)).toBe(true)
	})

	it("gives a user with no known role nothing", () => {
		expect(resolveUserFeatures(principal(["AgentMaintainer"]), APP_ROLES, flags)).toEqual(NO_FEATURES)
	})
})
