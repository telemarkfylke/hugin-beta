import { describe, expect, it, vi } from "vitest"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"

vi.mock("$lib/server/app-config/app-config", () => ({
	APP_CONFIG: { APP_ROLES: { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee", QA: "QA" } }
}))

const { applyRolePreview } = await import("../../../src/lib/server/auth/role-preview")

const principal = (roles: string[]): AuthenticatedPrincipal => ({ userId: "u1", name: "Test", preferredUserName: "test", roles, groups: ["g1"] })
const withCookie = (cookie: string) => new Headers({ cookie })

describe("applyRolePreview", () => {
	it("previews as student: roles replaced, groups cleared, rolePreview set", () => {
		expect(applyRolePreview(principal(["QA", "Employee"]), withCookie("hugin_role_preview=STUDENT"))).toEqual({
			userId: "u1",
			name: "Test",
			preferredUserName: "test",
			roles: ["Student"],
			groups: [],
			rolePreview: "STUDENT"
		})
	})

	it("previews agent maintainer together with employee, like real agent maintainers", () => {
		expect(applyRolePreview(principal(["QA"]), withCookie("hugin_role_preview=AGENT_MAINTAINER")).roles).toEqual(["AgentMaintainer", "Employee"])
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
