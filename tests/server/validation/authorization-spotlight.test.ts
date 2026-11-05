import { describe, expect, it } from "vitest"
import { canSeeSpotlight } from "../../../src/lib/authorization"
import { splitAppRoles } from "../../../src/lib/server/auth/principal-roles"
import type { AppRoles } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"

const appRoles: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }

const userWithRoles = (...roles: string[]): AuthenticatedPrincipal => ({ userId: "user-1", name: "Test", preferredUserName: "test", ...splitAppRoles(roles, appRoles), groups: [] })

describe("canSeeSpotlight", () => {
	it("shows a student spotlight to students and admins, not to edu employees or employees", () => {
		expect(canSeeSpotlight(userWithRoles("Student"), ["student"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("Admin"), ["student"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("eduemployee"), ["student"])).toBe(false)
		expect(canSeeSpotlight(userWithRoles("Employee"), ["student"])).toBe(false)
	})

	it("still shows an edu_employee spotlight to edu employees", () => {
		expect(canSeeSpotlight(userWithRoles("eduemployee"), ["employee", "edu_employee"])).toBe(true)
		expect(canSeeSpotlight(userWithRoles("Student"), ["employee", "edu_employee"])).toBe(false)
	})
})
