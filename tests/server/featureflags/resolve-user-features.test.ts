import { describe, expect, it } from "vitest"
import { type FeatureFlag, NO_FEATURES, resolveUserFeatures } from "../../../src/lib/featureflags/types"
import type { Affiliation, AuthenticatedPrincipal, HuginRole } from "../../../src/lib/types/authentication"

const principal = (affiliations: Affiliation[], huginRoles: HuginRole[] = []): AuthenticatedPrincipal => ({
	userId: "u1",
	name: "Test",
	preferredUserName: "test",
	affiliations,
	huginRoles,
	groups: []
})

const flag = (feature: FeatureFlag["feature"], roles: FeatureFlag["roles"]): FeatureFlag => ({ feature, roles, updatedAt: null, updatedBy: null })

const flags: FeatureFlag[] = [
	flag("ragservice", { employee: true, edu_employee: false, student: false }),
	flag("transcription", { employee: true, edu_employee: true, student: false }),
	flag("canvas", { employee: false, edu_employee: false, student: true })
]

describe("resolveUserFeatures", () => {
	it("grants a feature when one of the user's roles has it", () => {
		const features = resolveUserFeatures(principal(["employee"]), flags)
		expect(features.ragservice).toBe(true)
		expect(features.transcription).toBe(true)
		expect(features.canvas).toBe(false)
	})

	it("combines roles - a student who is also edu_employee gets what either has", () => {
		const features = resolveUserFeatures(principal(["student", "edu_employee"]), flags)
		expect(features.transcription).toBe(true)
		expect(features.canvas).toBe(true)
		expect(features.ragservice).toBe(false)
	})

	it("gives a feature missing from the flags to nobody but admin", () => {
		expect(resolveUserFeatures(principal(["employee", "student", "edu_employee"]), flags).history).toBe(false)
		expect(resolveUserFeatures(principal([], ["admin"]), flags).history).toBe(true)
	})

	it("gives admin everything, even with no flags loaded", () => {
		expect(Object.values(resolveUserFeatures(principal([], ["admin"]), [])).every(Boolean)).toBe(true)
	})

	it("gives Hugin roles other than admin no features - those come from affiliation only", () => {
		expect(resolveUserFeatures(principal([], ["agentMaintainer", "qa"]), flags)).toEqual(NO_FEATURES)
	})
})
