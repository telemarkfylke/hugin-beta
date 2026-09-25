export type CanvasTool = {
	id: string
	label: string
	icon: string // Material Symbols name
	href: string
}

export const CANVAS_TOOLS: CanvasTool[] = [
	{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" },
	{ id: "mermaid", label: "Diagram", icon: "schema", href: "/canvas/mermaid" },
	{ id: "presentation", label: "Presentasjon", icon: "slideshow", href: "/canvas/presentation" }
]

export const shouldShowToolTabs = (tools: CanvasTool[]): boolean => tools.length > 0
