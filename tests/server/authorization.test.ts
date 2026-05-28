import { describe, expect, it } from "vitest"
import { canDeleteChatConfig, canEditPredefinedConfig, canPromptConfig, canPublishChatConfig, canUpdateChatConfig, canViewAllChatConfigs, getUserRoleAccessGroups } from "$lib/authorization"
import type { AppConfig, AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatConfig } from "$lib/types/chat"

const appRoles: AppRoles = {
	ADMIN: "Admin",
	AGENT_MAINTAINER: "AgentMaintainer",
	EMPLOYEE: "Employee",
	STUDENT: "Student",
	EDU_EMPLOYEE: "EduEmployee"
}

const appConfig = { APP_ROLES: appRoles } as AppConfig

const user = (overrides: Partial<AuthenticatedPrincipal>): AuthenticatedPrincipal => ({
	userId: "user-1",
	name: "User One",
	preferredUserName: "user@example.com",
	roles: ["Employee"],
	groups: [],
	...overrides
})

const config = (overrides: Partial<ChatConfig>): ChatConfig => ({
	_id: "config-1",
	name: "Config",
	description: "Description",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-4.1",
	type: "private",
	accessGroups: [],
	created: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1", name: "Owner" } },
	updated: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1", name: "Owner" } },
	...overrides
})

describe("authorization rules", () => {
	it("allows admins to view, publish, edit predefined configs and prompt any config", () => {
		const admin = user({ roles: ["Admin"] })

		expect(canViewAllChatConfigs(admin, appRoles)).toBe(true)
		expect(canPublishChatConfig(admin, appRoles)).toBe(true)
		expect(canEditPredefinedConfig(admin, appRoles)).toBe(true)
		expect(canPromptConfig(admin, appConfig, config({ type: "private" }))).toBe(true)
	})

	it("allows agent maintainers to publish and prompt published configs", () => {
		const maintainer = user({ roles: ["AgentMaintainer"] })

		expect(canPublishChatConfig(maintainer, appRoles)).toBe(true)
		expect(canEditPredefinedConfig(maintainer, appRoles)).toBe(true)
		expect(canPromptConfig(maintainer, appConfig, config({ type: "published" }))).toBe(true)
	})

	it("allows owners to prompt private configs", () => {
		expect(canPromptConfig(user({ userId: "owner-1" }), appConfig, config({ type: "private" }))).toBe(true)
	})

	it("allows access through published role access groups", () => {
		expect(canPromptConfig(user({ roles: ["Employee"] }), appConfig, config({ type: "published", accessGroups: ["employee"] }))).toBe(true)
		expect(canPromptConfig(user({ roles: ["Student"] }), appConfig, config({ type: "published", accessGroups: ["student"] }))).toBe(true)
		expect(canPromptConfig(user({ roles: ["EduEmployee"] }), appConfig, config({ type: "published", accessGroups: ["student"] }))).toBe(true)
	})

	it("allows access through Entra groups", () => {
		expect(canPromptConfig(user({ groups: ["group-1"] }), appConfig, config({ type: "published", accessGroups: [{ id: "group-1", displayName: "Group 1" }] }))).toBe(true)
	})

	it("currently allows any authenticated user to prompt shared configs", () => {
		expect(canPromptConfig(user({ userId: "not-owner" }), appConfig, config({ type: "private", shared: true }))).toBe(true)
	})

	it("rejects users without matching access", () => {
		expect(canPromptConfig(user({ userId: "not-owner", roles: ["Employee"], groups: [] }), appConfig, config({ type: "private" }))).toBe(false)
		expect(canPromptConfig(user({ roles: ["Employee"] }), appConfig, config({ type: "published", accessGroups: ["student"] }))).toBe(false)
	})

	it("allows update by owner, admin, or maintainer of published config", () => {
		const existingPrivate = config({ created: { at: "now", by: { id: "owner-1" } } })
		const existingPublished = config({ type: "published" })

		expect(canUpdateChatConfig(user({ userId: "owner-1" }), appRoles, existingPrivate, existingPrivate)).toBe(true)
		expect(canUpdateChatConfig(user({ roles: ["Admin"] }), appRoles, existingPrivate, existingPrivate)).toBe(true)
		expect(canUpdateChatConfig(user({ roles: ["AgentMaintainer"] }), appRoles, existingPublished, existingPublished)).toBe(true)
	})
})

describe("getUserRoleAccessGroups", () => {
	it("returns only 'all' for a user with no special roles", () => {
		const u = user({ roles: [] })
		expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all"])
	})

	it("includes 'employee' for Employee role", () => {
		const u = user({ roles: ["Employee"] })
		expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "employee"])
	})

	it("includes 'edu_employee' and 'student' for EduEmployee role", () => {
		const u = user({ roles: ["EduEmployee"] })
		expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "edu_employee", "student"])
	})

	it("does NOT include 'student' twice when user has both EduEmployee and Student roles", () => {
		const u = user({ roles: ["EduEmployee", "Student"] })
		const groups = getUserRoleAccessGroups(u, appRoles)
		const studentCount = groups.filter((g) => g === "student").length
		expect(studentCount).toBe(1)
		expect(groups).toEqual(["all", "edu_employee", "student"])
	})

	it("includes 'student' for Student role only", () => {
		const u = user({ roles: ["Student"] })
		expect(getUserRoleAccessGroups(u, appRoles)).toEqual(["all", "student"])
	})
})

describe("canDeleteChatConfig", () => {
	it("allows admin to delete any config", () => {
		expect(canDeleteChatConfig(user({ roles: ["Admin"] }), appRoles, config({ type: "private", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "other", name: "Other" } } }))).toBe(true)
	})

	it("allows config owner to delete their own config", () => {
		expect(canDeleteChatConfig(user({ userId: "owner-1" }), appRoles, config({ created: { at: "2026-01-01T00:00:00.000Z", by: { id: "owner-1", name: "Owner" } } }))).toBe(true)
	})

	it("blocks AgentMaintainer from deleting a published config they do not own", () => {
		expect(
			canDeleteChatConfig(
				user({ roles: ["AgentMaintainer"], userId: "user-1" }),
				appRoles,
				config({ type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "other", name: "Other" } } })
			)
		).toBe(false)
	})

	it("allows AgentMaintainer to delete their own published config", () => {
		expect(
			canDeleteChatConfig(
				user({ roles: ["AgentMaintainer"], userId: "user-1" }),
				appRoles,
				config({ type: "published", created: { at: "2026-01-01T00:00:00.000Z", by: { id: "user-1", name: "User One" } } })
			)
		).toBe(true)
	})
})
