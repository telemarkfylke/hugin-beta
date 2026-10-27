import { describe, expect, it } from "vitest"
import { acquireExportSlot } from "$lib/server/canvas/presentation/export-slots"
import { HTTPError } from "$lib/server/middleware/http-error"

const expect429 = (fn: () => unknown) => {
	try {
		fn()
	} catch (error) {
		expect(error).toBeInstanceOf(HTTPError)
		expect((error as HTTPError).status).toBe(429)
		return
	}
	throw new Error("Expected HTTPError 429, nothing was thrown")
}

describe("acquireExportSlot", () => {
	it("allows one export per user at a time", () => {
		const release = acquireExportSlot("user-a")
		expect429(() => acquireExportSlot("user-a"))
		release()
		acquireExportSlot("user-a")()
	})

	it("caps exports across all users, and frees the slot on release", () => {
		const releases = [acquireExportSlot("u1"), acquireExportSlot("u2"), acquireExportSlot("u3")]
		expect429(() => acquireExportSlot("u4"))
		releases[0]?.()
		const release4 = acquireExportSlot("u4")
		releases.slice(1).forEach((release) => {
			release()
		})
		release4()
	})

	it("ignores a second release of the same slot", () => {
		const release = acquireExportSlot("user-b")
		release()
		release()
		const others = [acquireExportSlot("x1"), acquireExportSlot("x2"), acquireExportSlot("x3")]
		expect429(() => acquireExportSlot("x4"))
		others.forEach((r) => {
			r()
		})
	})
})
