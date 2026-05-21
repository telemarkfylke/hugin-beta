import { describe, expect, it } from "vitest"
import { HTTPError } from "$lib/server/middleware/http-error"
import { assertValidObjectId, isValidObjectId } from "$lib/validation/object-id"

describe("ObjectId validation", () => {
	it("accepts 24-character hex strings", () => {
		expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true)
		expect(() => assertValidObjectId("507f1f77bcf86cd799439011", "_id")).not.toThrow()
	})

	it("rejects non-hex and wrong-length values", () => {
		expect(isValidObjectId("not-an-object-id")).toBe(false)
		expect(isValidObjectId("abcdefghijkl")).toBe(false)
		expect(isValidObjectId("507f1f77bcf86cd79943901")).toBe(false)
		expect(() => assertValidObjectId("not-an-object-id", "_id")).toThrow(HTTPError)
	})
})
