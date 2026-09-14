import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import PptxGenJS from "pptxgenjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.join(__dirname, "../src/lib/server/canvas/presentation/templates/tfk-mal.pptx")

const pptx = new PptxGenJS()

const titleSlide = pptx.addSlide()
titleSlide.addText("Tittel", {
	objectName: "Title",
	x: 0.5,
	y: 2.5,
	w: 9,
	h: 1.5,
	fontSize: 40,
	bold: true,
	align: "center"
})

const contentSlide = pptx.addSlide()
contentSlide.addText("Overskrift", {
	objectName: "Title",
	x: 0.5,
	y: 0.4,
	w: 9,
	h: 1,
	fontSize: 28,
	bold: true
})
contentSlide.addText("Innhold", {
	objectName: "Body",
	x: 0.5,
	y: 1.6,
	w: 9,
	h: 5,
	fontSize: 18
})

const buffer = await pptx.write({ outputType: "nodebuffer" })
writeFileSync(outputPath, buffer)
console.log(`Wrote placeholder template to ${outputPath}`)
