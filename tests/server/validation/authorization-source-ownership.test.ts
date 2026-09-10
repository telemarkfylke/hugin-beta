import { describe, expect, it } from "vitest"
import { canEditMcpSource, canEditWebsiteSource, canViewMcpSource, canViewWebsiteSource } from "../../../src/lib/authorization"
import type { AppRoles } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"
import type { McpSource } from "../../../src/lib/types/mcp-source"
import type { WebsiteSource } from "../../../src/lib/types/website-source"

const appRoles: AppRoles = { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee" }

const owner: AuthenticatedPrincipal = { userId: "owner-1", name: "Eier", preferredUserName: "owner", roles: ["Employee"], groups: [] }
const otherEmployee: AuthenticatedPrincipal = { userId: "other-1", name: "Annen", preferredUserName: "other", roles: ["Employee"], groups: [] }
const admin: AuthenticatedPrincipal = { userId: "admin-1", name: "Admin", preferredUserName: "admin", roles: ["Admin"], groups: [] }

const baseMcpSource: McpSource = {
	_id: "mcp-1",
	server: "sharepoint",
	name: "Test",
	type: "private",
	folders: [{ value: "Budsjett", matchType: "prefix" }],
	searchEnabled: false,
	createdBy: { id: owner.userId },
	createdAt: "",
	updatedAt: ""
}

const baseWebsiteSource: WebsiteSource = {
	_id: "web-1",
	name: "Test",
	type: "private",
	entries: [{ value: "https://example.no", matchType: "prefix" }],
	createdBy: { id: owner.userId },
	createdAt: "",
	updatedAt: ""
}

describe("canViewMcpSource / canViewWebsiteSource", () => {
	it("the owner can always view their own source, private or published", () => {
		expect(canViewMcpSource(baseMcpSource, owner, appRoles)).toBe(true)
		expect(canViewWebsiteSource(baseWebsiteSource, owner, appRoles)).toBe(true)
	})

	it("another employee cannot view a private source - this is the actual incident this fixes: every source was visible to every employee regardless of ownership", () => {
		expect(canViewMcpSource(baseMcpSource, otherEmployee, appRoles)).toBe(false)
		expect(canViewWebsiteSource(baseWebsiteSource, otherEmployee, appRoles)).toBe(false)
	})

	it("another employee CAN view a published source", () => {
		const published: McpSource = { ...baseMcpSource, type: "published" }
		const publishedWebsite: WebsiteSource = { ...baseWebsiteSource, type: "published" }
		expect(canViewMcpSource(published, otherEmployee, appRoles)).toBe(true)
		expect(canViewWebsiteSource(publishedWebsite, otherEmployee, appRoles)).toBe(true)
	})

	it("an admin can view any source regardless of type or ownership", () => {
		expect(canViewMcpSource(baseMcpSource, admin, appRoles)).toBe(true)
		expect(canViewWebsiteSource(baseWebsiteSource, admin, appRoles)).toBe(true)
	})
})

describe("canEditMcpSource / canEditWebsiteSource", () => {
	it("the owner can edit their own source, private or published", () => {
		expect(canEditMcpSource(baseMcpSource, owner, appRoles)).toBe(true)
		expect(canEditMcpSource({ ...baseMcpSource, type: "published" }, owner, appRoles)).toBe(true)
		expect(canEditWebsiteSource(baseWebsiteSource, owner, appRoles)).toBe(true)
	})

	it("another employee cannot edit a source they don't own, even if it's published - this is the actual incident this fixes: any employee could edit/delete anyone else's source", () => {
		const published: McpSource = { ...baseMcpSource, type: "published" }
		expect(canEditMcpSource(published, otherEmployee, appRoles)).toBe(false)
		expect(canEditWebsiteSource({ ...baseWebsiteSource, type: "published" }, otherEmployee, appRoles)).toBe(false)
	})

	it("an admin can edit any source regardless of ownership", () => {
		expect(canEditMcpSource(baseMcpSource, admin, appRoles)).toBe(true)
		expect(canEditWebsiteSource(baseWebsiteSource, admin, appRoles)).toBe(true)
	})
})
