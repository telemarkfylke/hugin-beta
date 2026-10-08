// Visual style for Excalidraw diagrams. Kept free of Excalidraw imports (the package is large and
// browser-only) so it can be unit-tested and loaded cheaply - the numbers mirror Excalidraw's constants.
export type DiagramStyle = "sketch" | "clean"

// Excalidraw FONT_FAMILY: Excalifont = 5 (hand-drawn), Nunito = 6 (clean sans, close to Hugin's own font)
const EXCALIFONT = 5
const NUNITO = 6

export const DIAGRAM_STYLES: Record<DiagramStyle, { label: string; roughness: 0 | 1; fontFamily: number }> = {
	sketch: { label: "Håndtegnet", roughness: 1, fontFamily: EXCALIFONT },
	clean: { label: "Ren", roughness: 0, fontFamily: NUNITO }
}

export const DIAGRAM_STYLE_STORAGE_KEY = "hugin_diagram_style"

export const parseDiagramStyle = (value: string | null | undefined): DiagramStyle => (value === "clean" ? "clean" : "sketch")

// The element fields a style changes: stroke roughness for shapes/arrows, and the font for text
export const diagramStyleUpdates = (element: { type: string }, style: DiagramStyle): { roughness: 0 | 1; fontFamily?: number } => {
	const { roughness, fontFamily } = DIAGRAM_STYLES[style]
	return element.type === "text" ? { roughness, fontFamily } : { roughness }
}

// Put the font on Mermaid-converted skeletons BEFORE Excalidraw converts them, so text is measured and
// wrapped with the font it is shown in (changing fontFamily afterwards leaves Excalifont-sized boxes).
export const styleSkeleton = <T extends { type: string; label?: object }>(skeleton: T, style: DiagramStyle): T => {
	const { fontFamily } = DIAGRAM_STYLES[style]
	if (skeleton.type === "text") return { ...skeleton, fontFamily }
	if (skeleton.label) return { ...skeleton, label: { ...skeleton.label, fontFamily } }
	return skeleton
}

// Cheap fingerprint of a drawing: changes whenever any element is edited, moved or added/removed
export const sceneFingerprint = (elements: readonly { id: string; version: number }[]): string => elements.map((element) => `${element.id}:${element.version}`).join("|")
