import { describe, expect, it } from "vitest"
import { resolveConfig } from "$lib/server/models/model-registry"
import type { ModelSelection } from "$lib/server/models/resolve"
import type { VendorId } from "$lib/types/chat"

describe("resolveConfig with the real app config", () => {
	// Early versions stored lowercase vendor ids - resolution must not crash (it would 500 the whole agents list)
	it("does not throw for a stored config with an unknown vendor id and its own project", () => {
		const resolved = resolveConfig<ModelSelection>({ _id: "old", vendorId: "openai" as VendorId, project: "HR", model: "gpt-4o" })
		expect(resolved.profile).toBe("rask")
		expect(resolved.pinned).toBeUndefined()
	})
})
