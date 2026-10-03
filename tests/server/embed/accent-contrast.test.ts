import { describe, expect, it } from "vitest"
import { getAccentContrastText } from "../../../src/lib/embed/accent-contrast"

describe("getAccentContrastText", () => {
	it("picks black text on a white accent", () => {
		expect(getAccentContrastText("ffffff")).toBe("#000000")
	})

	it("picks white text on a black accent", () => {
		expect(getAccentContrastText("000000")).toBe("#ffffff")
	})

	it("picks white text on a dark blue accent", () => {
		expect(getAccentContrastText("0052a6")).toBe("#ffffff")
	})

	it("picks black text on a bright yellow accent", () => {
		expect(getAccentContrastText("ffeb3b")).toBe("#000000")
	})
})
