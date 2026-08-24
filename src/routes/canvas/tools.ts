export type CanvasTool = {
	id: string
	label: string
	icon: string // Material Symbols name
	href: string
}

export const CANVAS_TOOLS: CanvasTool[] = [
	{ id: "document", label: "Dokument", icon: "description", href: "/canvas/document" },
	{ id: "mermaid", label: "Diagram", icon: "schema", href: "/canvas/mermaid" }
]

export const shouldShowToolTabs = (tools: CanvasTool[]): boolean => tools.length > 0
