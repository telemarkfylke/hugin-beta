import { describe, expect, it } from "vitest"
import { canManageMcpSources, canUseCanvas, canUseDatasources, canUseRagservice, canUseWebsiteDataSource } from "../../../src/lib/authorization"
import type { AppRoles } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"

const appRoles: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }

const userWithRoles = (...roles: string[]): AuthenticatedPrincipal => ({ userId: "user-1", name: "Test", preferredUserName: "test", roles, groups: [] })

const admin = userWithRoles("Admin")
const maintainer = userWithRoles("AgentMaintainer")
const employee = userWithRoles("Employee")
const eduEmployee = userWithRoles("eduemployee")
const student = userWithRoles("Student")
const qa = userWithRoles("QA")

describe("canUseWebsiteDataSource", () => {
	it("is admin-only while the firewall blocks most outside sites", () => {
		expect(canUseWebsiteDataSource(admin, appRoles)).toBe(true)
		for (const user of [maintainer, employee, eduEmployee, student, qa]) {
			expect(canUseWebsiteDataSource(user, appRoles)).toBe(false)
		}
	})
})

describe("canUseDatasources", () => {
	it("is true exactly when the user has at least one Datakilder tab", () => {
		for (const user of [admin, maintainer, employee, eduEmployee, student, qa]) {
			const anyTab = canUseRagservice(user, appRoles) || canManageMcpSources(user, appRoles) || canUseWebsiteDataSource(user, appRoles)
			expect(canUseDatasources(user, appRoles)).toBe(anyTab)
		}
	})

	it("lets admins and employees in, and keeps everyone else out", () => {
		expect(canUseDatasources(admin, appRoles)).toBe(true)
		expect(canUseDatasources(employee, appRoles)).toBe(true)
		expect(canUseDatasources(maintainer, appRoles)).toBe(false)
		expect(canUseDatasources(eduEmployee, appRoles)).toBe(false)
		expect(canUseDatasources(student, appRoles)).toBe(false)
		expect(canUseDatasources(qa, appRoles)).toBe(false)
	})
})

describe("canUseCanvas", () => {
	it("includes students and school staff, not maintainer-only or QA-only users", () => {
		expect(canUseCanvas(admin, appRoles)).toBe(true)
		expect(canUseCanvas(employee, appRoles)).toBe(true)
		expect(canUseCanvas(eduEmployee, appRoles)).toBe(true)
		expect(canUseCanvas(student, appRoles)).toBe(true)
		expect(canUseCanvas(maintainer, appRoles)).toBe(false)
		expect(canUseCanvas(qa, appRoles)).toBe(false)
	})
})
