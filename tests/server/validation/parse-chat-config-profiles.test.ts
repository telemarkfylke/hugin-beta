import { describe, expect, it } from "vitest"
import { HTTPError } from "../../../src/lib/server/middleware/http-error"
import type { AppConfig } from "../../../src/lib/types/app-config"
import type { AuthenticatedPrincipal } from "../../../src/lib/types/authentication"
import type { ChatConfig } from "../../../src/lib/types/chat"
import type { ClientModelProfile } from "../../../src/lib/types/model-profiles"
import { parseChatConfig } from "../../../src/lib/validation/parse-chat-config"

const profile = (id: string, extra: Partial<ClientModelProfile> = {}): ClientModelProfile => ({
	id,
	label: id,
	icon: "",
	description: "",
	vendorId: "OPENAI",
	model: "gpt-live",
	project: "DEFAULT",
	capabilities: [],
	mimeTypes: { FILE: [], IMAGE: [] },
	...extra
})

const noMime = { FILE: [], IMAGE: [] }
const APP_CONFIG = {
	APP_ROLES: { ADMIN: "Admin", AGENT_MAINTAINER: "AgentMaintainer", EMPLOYEE: "Employee", STUDENT: "Student", EDU_EMPLOYEE: "eduemployee" },
	MODEL_PROFILES: [profile("rask"), profile("lokal", { roles: ["employee"] })],
	VENDORS: {
		OPENAI: {
			NAME: "OpenAI",
			ENABLED: true,
			PROJECTS: ["DEFAULT", "STUDENTS"],
			MODELS: [
				{ KEY: "gpt-live", ID: "gpt-live", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: [], RETIRED: false },
				{ KEY: "gpt-old", ID: "gpt-old", SUPPORTED_MESSAGE_FILE_MIME_TYPES: noMime, CAPABILITIES: [], RETIRED: true }
			]
		}
	}
} as unknown as AppConfig

const user = (roles: string[]): AuthenticatedPrincipal => ({ userId: "u1", name: "U", preferredUserName: "u", roles, groups: [] })
const admin = user(["Admin"])
const employee = user(["Employee"])
const student = user(["Student"])

const base = {
	_id: "1",
	name: "n",
	description: "d",
	vendorId: "OPENAI",
	project: "DEFAULT",
	model: "gpt-live",
	type: "private",
	accessGroups: ["all"],
	created: { at: "now", by: { id: "u1" } },
	updated: { at: "now", by: { id: "u1" } }
}
const stored = (overrides: Partial<ChatConfig>): ChatConfig => ({ ...base, ...overrides }) as ChatConfig

const expectStatus = (fn: () => unknown, status: number) => {
	try {
		fn()
	} catch (error) {
		expect(error).toBeInstanceOf(HTTPError)
		expect((error as HTTPError).status).toBe(status)
		return
	}
	throw new Error(`Expected HTTPError ${status}, nothing was thrown`)
}

describe("parseChatConfig - save mode", () => {
	it("accepts and copies a profile the user may choose", () => {
		const config = parseChatConfig({ ...base, profile: "rask" }, APP_CONFIG, { mode: "save", user: employee, previous: null })
		expect(config.profile).toBe("rask")
	})

	it("rejects an unknown profile with 400", () => {
		expectStatus(() => parseChatConfig({ ...base, profile: "nope" }, APP_CONFIG, { mode: "save", user: employee, previous: null }), 400)
	})

	it("rejects a role-restricted profile with 403", () => {
		expectStatus(() => parseChatConfig({ ...base, profile: "lokal" }, APP_CONFIG, { mode: "save", user: student, previous: null }), 403)
	})

	it("allows an unchanged role-restricted profile on update", () => {
		const config = parseChatConfig({ ...base, profile: "lokal" }, APP_CONFIG, { mode: "save", user: student, previous: stored({ profile: "lokal" }) })
		expect(config.profile).toBe("lokal")
	})

	it("rejects a new pin from a non-admin with 403", () => {
		expectStatus(() => parseChatConfig({ ...base, profile: "rask", pinned: { model: "gpt-live", project: "DEFAULT" } }, APP_CONFIG, { mode: "save", user: employee, previous: null }), 403)
	})

	it("accepts and copies an admin pin", () => {
		const config = parseChatConfig({ ...base, profile: "rask", pinned: { model: "gpt-live", project: "STUDENTS" } }, APP_CONFIG, { mode: "save", user: admin, previous: null })
		expect(config.pinned).toEqual({ model: "gpt-live", project: "STUDENTS" })
	})

	it("rejects pinning a retired model with 400", () => {
		expectStatus(() => parseChatConfig({ ...base, pinned: { model: "gpt-old", project: "DEFAULT" } }, APP_CONFIG, { mode: "save", user: admin, previous: null }), 400)
	})

	it("rejects pinning an unknown project with 400", () => {
		expectStatus(() => parseChatConfig({ ...base, pinned: { model: "gpt-live", project: "NOPE" } }, APP_CONFIG, { mode: "save", user: admin, previous: null }), 400)
	})

	it("lets a non-admin co-editor save an assistant with an unchanged admin pin", () => {
		const pinned = { model: "gpt-live", project: "STUDENTS" }
		const config = parseChatConfig({ ...base, profile: "rask", pinned }, APP_CONFIG, { mode: "save", user: employee, previous: stored({ profile: "rask", pinned }) })
		expect(config.pinned).toEqual(pinned)
	})

	it("rejects a non-admin removing an existing pin with 403", () => {
		const previous = stored({ profile: "rask", pinned: { model: "gpt-live", project: "STUDENTS" } })
		expectStatus(() => parseChatConfig({ ...base, profile: "rask" }, APP_CONFIG, { mode: "save", user: employee, previous }), 403)
	})

	it("lets an admin remove an existing pin", () => {
		const previous = stored({ profile: "rask", pinned: { model: "gpt-live", project: "STUDENTS" } })
		const config = parseChatConfig({ ...base, profile: "rask" }, APP_CONFIG, { mode: "save", user: admin, previous })
		expect(config.pinned).toBeUndefined()
	})

	it("rejects a manual config without profile or pinned on create with 400", () => {
		expectStatus(() => parseChatConfig({ ...base }, APP_CONFIG, { mode: "save", user: employee, previous: null }), 400)
	})

	it("rejects a manual config that drops its profile on update with 400", () => {
		expectStatus(() => parseChatConfig({ ...base }, APP_CONFIG, { mode: "save", user: student, previous: stored({ profile: "rask" }) }), 400)
	})

	it("accepts a pinned-only admin config without a profile", () => {
		const config = parseChatConfig({ ...base, pinned: { model: "gpt-live", project: "DEFAULT" } }, APP_CONFIG, { mode: "save", user: admin, previous: null })
		expect(config.profile).toBeUndefined()
		expect(config.pinned).toEqual({ model: "gpt-live", project: "DEFAULT" })
	})

	it("does not require a profile on vendor-agent configs", () => {
		const config = parseChatConfig({ ...base, vendorAgent: { id: "agent-1" } }, APP_CONFIG, { mode: "save", user: employee, previous: null })
		expect(config.vendorAgent).toEqual({ id: "agent-1" })
	})

	it("rejects a non-admin changing an existing pin's project with 403", () => {
		const previous = stored({ profile: "rask", pinned: { model: "gpt-live", project: "STUDENTS" } })
		expectStatus(() => parseChatConfig({ ...base, profile: "rask", pinned: { model: "gpt-live", project: "DEFAULT" } }, APP_CONFIG, { mode: "save", user: employee, previous }), 403)
	})
})

describe("parseChatConfig - use mode", () => {
	it("accepts a student using a pinned, role-restricted assistant", () => {
		const config = parseChatConfig({ ...base, profile: "lokal", pinned: { model: "gpt-live", project: "STUDENTS" } }, APP_CONFIG, { mode: "use" })
		expect(config).toMatchObject({ profile: "lokal", pinned: { model: "gpt-live", project: "STUDENTS" } })
	})

	it("still accepts a profile-less (pre-profile) config", () => {
		expect(parseChatConfig({ ...base }, APP_CONFIG, { mode: "use" }).profile).toBeUndefined()
	})

	it("leaves an unknown profile to resolution instead of rejecting", () => {
		expect(parseChatConfig({ ...base, profile: "gone" }, APP_CONFIG, { mode: "use" }).profile).toBe("gone")
	})

	it("still rejects a profile-less config with an unknown model (pre-profile behaviour)", () => {
		expectStatus(() => parseChatConfig({ ...base, model: "gpt-nope" }, APP_CONFIG, { mode: "use" }), 400)
	})

	it("drops profile/pinned from vendor-agent configs", () => {
		const config = parseChatConfig({ ...base, vendorAgent: { id: "agent-1" }, profile: "rask", pinned: { model: "gpt-live", project: "DEFAULT" } }, APP_CONFIG, { mode: "use" })
		expect(config.profile).toBeUndefined()
		expect(config.pinned).toBeUndefined()
	})
})
