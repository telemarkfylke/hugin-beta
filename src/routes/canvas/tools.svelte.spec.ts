import { describe, expect, it } from "vitest"
import { CANVAS_TOOLS, type CanvasTool, shouldShowToolTabs } from "./tools"

describe("shouldShowToolTabs", () => {
	it("returns false when there is only one tool", () => {
		const tools: CanvasTool[] = [{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" }]
		expect(shouldShowToolTabs(tools)).toBe(false)
	})

	it("returns false when there are zero tools", () => {
		expect(shouldShowToolTabs([])).toBe(false)
	})

	it("returns true once a second tool is registered", () => {
		const tools: CanvasTool[] = [
			{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" },
			{ id: "mermaid", label: "Diagram", icon: "schema", href: "/canvas/mermaid" }
		]
		expect(shouldShowToolTabs(tools)).toBe(true)
	})

	it("the real registry today has exactly one tool, so tabs stay hidden", () => {
		expect(shouldShowToolTabs(CANVAS_TOOLS)).toBe(false)
	})
})
