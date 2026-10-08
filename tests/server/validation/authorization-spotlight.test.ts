import { describe, expect, it } from "vitest"
import { canSeeSpotlight } from "../../../src/lib/authorization"
import type { AppRoles } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"

const appRoles: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }

const userWithRoles = (...roles: string[]): AuthenticatedPrincipal => ({ userId: "user-1", name: "Test", preferredUserName: "test", roles, groups: [] })

describe("canSeeSpotlight", () => {
	it("shows a student spotlight to students and admins, not to edu employees or employees", () => {
		expect(canSeeSpotlight(userWithRoles("Student"), appRoles, ["student"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("Admin"), appRoles, ["student"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("eduemployee"), appRoles, ["student"])).toBe(false)
		expect(canSeeSpotlight(userWithRoles("Employee"), appRoles, ["student"])).toBe(false)
	})

	it("still shows an edu_employee spotlight to edu employees", () => {
		expect(canSeeSpotlight(userWithRoles("eduemployee"), appRoles, ["employee", "edu_employee"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("Student"), appRoles, ["employee", "edu_employee"])).toBe(false)
	})
})
