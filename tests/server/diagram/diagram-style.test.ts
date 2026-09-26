import { describe, expect, it } from "vitest"
import { DIAGRAM_STYLES, diagramStyleUpdates, parseDiagramStyle } from "$lib/diagram/diagram-style"

describe("diagram style", () => {
	it("gives text both roughness and font, shapes only roughness", () => {
		expect(diagramStyleUpdates({ type: "text" }, "clean")).toEqual({ roughness: 0, fontFamily: DIAGRAM_STYLES.clean.fontFamily })
		expect(diagramStyleUpdates({ type: "rectangle" }, "sketch")).toEqual({ roughness: 1 })
	})

	it("uses a hand-drawn font for sketch and a clean one for clean", () => {
		expect(DIAGRAM_STYLES.sketch.fontFamily).not.toBe(DIAGRAM_STYLES.clean.fontFamily)
		expect(DIAGRAM_STYLES.sketch.roughness).toBeGreaterThan(DIAGRAM_STYLES.clean.roughness)
	})

	it("defaults unknown stored values to sketch", () => {
		expect(parseDiagramStyle("clean")).toBe("clean")
		expect(parseDiagramStyle(null)).toBe("sketch")
		expect(parseDiagramStyle("weird")).toBe("sketch")
	})
})
