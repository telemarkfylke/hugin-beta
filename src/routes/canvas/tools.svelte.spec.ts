import { describe, expect, it } from "vitest"
import { CANVAS_TOOLS, type CanvasTool, shouldShowToolTabs } from "./tools"

describe("shouldShowToolTabs", () => {
	it("returns true when there is only one tool", () => {
		const tools: CanvasTool[] = [{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" }]
		expect(shouldShowToolTabs(tools)).toBe(true)
	})

	it("returns false when there are zero tools", () => {
		expect(shouldShowToolTabs([])).toBe(false)
	})

	it("returns true with multiple tools registered", () => {
		const tools: CanvasTool[] = [
			{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" },
			{ id: "mermaid", label: "Diagram", icon: "schema", href: "/canvas/mermaid" }
		]
		expect(shouldShowToolTabs(tools)).toBe(true)
	})

	it("the real registry today has one tool, so the tab strip shows", () => {
		expect(shouldShowToolTabs(CANVAS_TOOLS)).toBe(true)
	})
})
