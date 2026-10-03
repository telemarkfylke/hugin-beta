// Copies Excalidraw's font files into static/ so they are served by Hugin itself instead of Excalidraw's
// CDN (esm.sh). Runs before dev and build (predev/prebuild). The output is gitignored - it's ~13 MB and
// always regenerated from the installed @excalidraw/excalidraw version, so fonts never drift from the code.
import { cpSync, existsSync, rmSync } from "node:fs"

const source = "node_modules/@excalidraw/excalidraw/dist/prod/fonts"
const target = "static/excalidraw-assets/fonts"

if (!existsSync(source)) {
	console.error(`[excalidraw-assets] ${source} not found - run npm install first`)
	process.exit(1)
}
rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })
console.log(`[excalidraw-assets] copied fonts to ${target}`)
