import { describe, expect, it } from "vitest"
import { sanitizeMermaid } from "$lib/diagram/sanitize-mermaid"

describe("sanitizeMermaid", () => {
	it("removes url() fills but keeps the other style properties", () => {
		expect(sanitizeMermaid("style probability fill:url(#diagonalHatch),stroke:#333,stroke-width:2px")).toBe("style probability stroke:#333,stroke-width:2px")
		expect(sanitizeMermaid("classDef risk stroke:#333,fill:url(#hatch)")).toBe("classDef risk stroke:#333")
	})

	it("drops a style line that only had url() values", () => {
		expect(sanitizeMermaid("flowchart TD\n  A --> B\n  style A fill:url(#grad)\n  B --> C")).toBe("flowchart TD\n  A --> B\n  B --> C")
	})

	it("handles linkStyle, ';' separators and !important", () => {
		expect(sanitizeMermaid("linkStyle 0 stroke:url(#a),stroke-width:2px")).toBe("linkStyle 0 stroke-width:2px")
		expect(sanitizeMermaid("style A fill:url(#a);stroke:#333")).toBe("style A stroke:#333")
		expect(sanitizeMermaid("style A fill:url(#a) !important,color:#fff")).toBe("style A color:#fff")
	})

	it("never touches lines that merely start with the word style (mindmap/timeline labels)", () => {
		const mindmap = "mindmap\n  root((Plan))\n    style guide \n    style\n    styleguide"
		expect(sanitizeMermaid(mindmap)).toBe(mindmap)
	})

	it("leaves valid diagrams untouched", () => {
		const code = "flowchart TD\n  A[Start] --> B{Valg}\n  style A fill:#E8F4FD,stroke:#0072B1"
		expect(sanitizeMermaid(code)).toBe(code)
	})
})
