import { describe, expect, it } from "vitest"
import { DIAGRAM_STYLES, diagramStyleUpdates, parseDiagramStyle, sceneFingerprint, styleSkeleton } from "$lib/diagram/diagram-style"

describe("diagram style", () => {
	it("gives text both roughness and font, shapes only roughness", () => {
		expect(diagramStyleUpdates({ type: "text" }, "clean")).toEqual({ roughness: 0, fontFamily: DIAGRAM_STYLES.clean.fontFamily })
		expect(diagramStyleUpdates({ type: "rectangle" }, "sketch")).toEqual({ roughness: 1 })
	})

	it("puts the font on text and container-label skeletons before conversion", () => {
		const font = DIAGRAM_STYLES.clean.fontFamily
		expect(styleSkeleton({ type: "text", text: "Hei" }, "clean")).toEqual({ type: "text", text: "Hei", fontFamily: font })
		expect(styleSkeleton({ type: "rectangle", label: { text: "Boks" } }, "clean")).toEqual({ type: "rectangle", label: { text: "Boks", fontFamily: font } })
		const arrow = { type: "arrow" }
		expect(styleSkeleton(arrow, "clean")).toBe(arrow)
	})

	it("changes the scene fingerprint when an element is edited, added or removed", () => {
		const scene = [
			{ id: "a", version: 1 },
			{ id: "b", version: 1 }
		]
		expect(sceneFingerprint(scene)).toBe(sceneFingerprint([...scene]))
		expect(sceneFingerprint(scene)).not.toBe(sceneFingerprint([{ id: "a", version: 2 }, scene[1] as { id: string; version: number }]))
		expect(sceneFingerprint(scene)).not.toBe(sceneFingerprint(scene.slice(0, 1)))
	})

	it("defaults unknown stored values to sketch", () => {
		expect(parseDiagramStyle("clean")).toBe("clean")
		expect(parseDiagramStyle(null)).toBe("sketch")
		expect(parseDiagramStyle("weird")).toBe("sketch")
	})
})
