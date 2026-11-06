import { describe, expect, it } from "vitest"
import { canEditMcpSource, canEditWebsiteSource, canViewMcpSource, canViewWebsiteSource } from "../../../src/lib/authorization"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"
import type { McpSource } from "../../../src/lib/types/mcp-source"
import type { WebsiteSource } from "../../../src/lib/types/website-source"

const owner: AuthenticatedPrincipal = { userId: "owner-1", name: "Eier", preferredUserName: "owner", affiliations: ["employee"], huginRoles: [], groups: [] }
const otherEmployee: AuthenticatedPrincipal = { userId: "other-1", name: "Annen", preferredUserName: "other", affiliations: ["employee"], huginRoles: [], groups: [] }
const admin: AuthenticatedPrincipal = { userId: "admin-1", name: "Admin", preferredUserName: "admin", affiliations: [], huginRoles: ["admin"], groups: [] }

const baseMcpSource: McpSource = {
	_id: "mcp-1",
	server: "sharepoint",
	name: "Test",
	type: "private",
	folders: [{ value: "Budsjett", matchType: "prefix" }],
	searchEnabled: false,
	lists: [],
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
		expect(canViewMcpSource(baseMcpSource, owner)).toBe(true)
		expect(canViewWebsiteSource(baseWebsiteSource, owner)).toBe(true)
	})

	it("another employee cannot view a private source - this is the actual incident this fixes: every source was visible to every employee regardless of ownership", () => {
		expect(canViewMcpSource(baseMcpSource, otherEmployee)).toBe(false)
		expect(canViewWebsiteSource(baseWebsiteSource, otherEmployee)).toBe(false)
	})

	it("another employee CAN view a published source", () => {
		const published: McpSource = { ...baseMcpSource, type: "published" }
		const publishedWebsite: WebsiteSource = { ...baseWebsiteSource, type: "published" }
		expect(canViewMcpSource(published, otherEmployee)).toBe(true)
		expect(canViewWebsiteSource(publishedWebsite, otherEmployee)).toBe(true)
	})

	it("an admin can view any source regardless of type or ownership", () => {
		expect(canViewMcpSource(baseMcpSource, admin)).toBe(true)
		expect(canViewWebsiteSource(baseWebsiteSource, admin)).toBe(true)
	})
})

describe("canEditMcpSource / canEditWebsiteSource", () => {
	it("the owner can edit their own source, private or published", () => {
		expect(canEditMcpSource(baseMcpSource, owner)).toBe(true)
		expect(canEditMcpSource({ ...baseMcpSource, type: "published" }, owner)).toBe(true)
		expect(canEditWebsiteSource(baseWebsiteSource, owner)).toBe(true)
	})

	it("another employee cannot edit a source they don't own, even if it's published - this is the actual incident this fixes: any employee could edit/delete anyone else's source", () => {
		const published: McpSource = { ...baseMcpSource, type: "published" }
		expect(canEditMcpSource(published, otherEmployee)).toBe(false)
		expect(canEditWebsiteSource({ ...baseWebsiteSource, type: "published" }, otherEmployee)).toBe(false)
	})

	it("an admin can edit any source regardless of ownership", () => {
		expect(canEditMcpSource(baseMcpSource, admin)).toBe(true)
		expect(canEditWebsiteSource(baseWebsiteSource, admin)).toBe(true)
	})
})
