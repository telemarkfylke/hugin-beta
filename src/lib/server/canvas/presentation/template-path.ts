import path from "node:path"

const TEMPLATE_RELATIVE_PATH = "src/lib/server/canvas/presentation/templates/tfk-mal.pptx"

// Resolved relative to process.cwd() rather than imported through Vite, so the binary template isn't
// bundled. The deploy package is not the whole repository (build/ + production node_modules), so
// publish-beta.yml copies this one file into the package at the same relative path - keep the two
// in sync if the template moves.
export const getPresentationTemplatePath = (): string => {
	return path.join(process.cwd(), TEMPLATE_RELATIVE_PATH)
}
