import { describe, expect, it, vi } from "vitest"
import { splitAppRoles } from "$lib/server/auth/principal-roles"
import type { AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

vi.mock("$lib/server/app-config/app-config", () => ({
	APP_CONFIG: { APP_ROLES: { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" } }
}))

const { applyRolePreview } = await import("../../../src/lib/server/auth/role-preview")

const APP_ROLES: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" }
// Takes Entra role values, like the real login does
const principal = (roles: string[]): AuthenticatedPrincipal => ({ userId: "u1", name: "Test", preferredUserName: "test", ...splitAppRoles(roles, APP_ROLES), groups: ["g1"] })
const withCookie = (cookie: string) => new Headers({ cookie })

describe("applyRolePreview", () => {
	it("previews as student: both role dimensions replaced, groups cleared, rolePreview set", () => {
		expect(applyRolePreview(principal(["QA", "Employee"]), withCookie("hugin_role_preview=STUDENT"))).toEqual({
			userId: "u1",
			name: "Test",
			preferredUserName: "test",
			affiliations: ["student"],
			huginRoles: [],
			groups: [],
			rolePreview: "STUDENT"
		})
	})

	it("previews agent maintainer as an employee, like real agent maintainers", () => {
		const previewed = applyRolePreview(principal(["QA"]), withCookie("hugin_role_preview=AGENT_MAINTAINER"))
		expect(previewed.affiliations).toEqual(["employee"])
		expect(previewed.huginRoles).toEqual(["agentMaintainer"])
	})

	it("drops admin when an admin previews as a lower role", () => {
		const previewed = applyRolePreview(principal(["QA", "Admin", "Employee"]), withCookie("hugin_role_preview=EMPLOYEE"))
		expect(previewed.huginRoles).toEqual([])
		expect(previewed.affiliations).toEqual(["employee"])
	})

	it("finds the cookie among other cookies", () => {
		expect(applyRolePreview(principal(["QA"]), withCookie("foo=bar; hugin_role_preview=EMPLOYEE; baz=1")).rolePreview).toBe("EMPLOYEE")
	})

	it("ignores the cookie for users without the QA role", () => {
		const user = principal(["Employee"])
		expect(applyRolePreview(user, withCookie("hugin_role_preview=AGENT_MAINTAINER"))).toBe(user)
	})

	it("never lets anyone preview as admin", () => {
		const user = principal(["QA"])
		expect(applyRolePreview(user, withCookie("hugin_role_preview=ADMIN"))).toBe(user)
	})

	it("leaves QA users unchanged without a preview cookie", () => {
		const user = principal(["QA"])
		expect(applyRolePreview(user, new Headers())).toBe(user)
	})
})
