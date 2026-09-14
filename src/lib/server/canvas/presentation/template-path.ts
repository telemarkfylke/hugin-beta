import path from "node:path"

const TEMPLATE_RELATIVE_PATH = "src/lib/server/canvas/presentation/templates/tfk-mal.pptx"

// Resolved relative to process.cwd() rather than imported through Vite: this project's Azure
// publish workflows deploy the entire repository tree (AZURE_FUNCTIONAPP_PACKAGE_PATH: '.'), not
// just the SvelteKit `build/` output, so this source-tree path is guaranteed to exist on disk at
// runtime without needing Vite to bundle a binary asset.
export const getPresentationTemplatePath = (): string => {
	return path.join(process.cwd(), TEMPLATE_RELATIVE_PATH)
}
