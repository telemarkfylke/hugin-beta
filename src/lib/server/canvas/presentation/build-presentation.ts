import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Automizer, ModifyTextHelper, modify } from "pptx-automizer"
import type { ParsedSlide } from "./parse-slides-for-export"
import { getPresentationTemplatePath } from "./template-path"

const TITLE_SLIDE_SOURCE_INDEX = 1
const CONTENT_SLIDE_SOURCE_INDEX = 2

// A single guard for "not a sane amount of slides to build": zero slides is undefined behavior
// downstream (no title slide to seed the deck), and an unbounded slide count is a real
// process-OOM vector since Automizer's per-slide memory cost scales roughly linearly (~200KB/slide
// measured against the placeholder template). 200 is generous for any real presentation while
// keeping worst-case memory in the tens of MB.
const MAX_SLIDE_COUNT = 200

// These must match the exact PowerPoint shape names (Home > Arrange > Selection Pane) in the
// template file at getPresentationTemplatePath(). The placeholder template built by
// scripts/generate-presentation-placeholder-template.js uses "Title" and "Body" — update these
// two constants once the real Telemark fylkeskommune template is checked in, if its shape names
// differ.
const TITLE_SHAPE_NAME = "Title"
const BODY_SHAPE_NAME = "Body"

// pptx-automizer's MultiTextParagraph carries its run text directly on `text` (or via
// `textRuns` for multiple runs per paragraph) — there is no `runs` field, despite that being a
// natural guess from the shape of other pptx-automizer APIs.
const toParagraphs = (body: ParsedSlide["body"]) =>
	body.map((line) => ({
		paragraph: { bullet: line.bullet, level: 0 },
		text: line.text
	}))

export const buildPresentation = async (slides: ParsedSlide[]): Promise<Buffer> => {
	if (slides.length === 0 || slides.length > MAX_SLIDE_COUNT) {
		throw new Error(`slides.length must be between 1 and ${MAX_SLIDE_COUNT}, got ${slides.length}`)
	}

	const templatePath = getPresentationTemplatePath()
	const outputDir = os.tmpdir()
	const outputFilename = `presentation-${randomUUID()}.pptx`

	const automizer = new Automizer({
		templateDir: path.dirname(templatePath),
		outputDir,
		removeExistingSlides: true,
		// The template's own 2 slides are only unlisted from the output's slide list (not deleted
		// from the archive) by removeExistingSlides — without cleanup, they'd remain as unused,
		// unreferenced parts inside the output .pptx alongside the newly generated slides.
		cleanup: true
	})
	// The root template is also loaded a second time under the alias "root": pptx-automizer's
	// addSlide() resolves its `name` argument against templates loaded via `.load()`, not against
	// the root template set by `.loadRoot()` — with removeExistingSlides enabled, slides from the
	// root file are otherwise unreachable as sources. See pptx-automizer's "Sort output slides"
	// docs (AI-INSTRUCTOR.md) for this exact pattern.
	automizer.loadRoot(path.basename(templatePath)).load(path.basename(templatePath), "root")

	const [firstSlide, ...restSlides] = slides
	if (firstSlide) {
		automizer.addSlide("root", TITLE_SLIDE_SOURCE_INDEX, (slide) => {
			slide.modifyElement(TITLE_SHAPE_NAME, modify.setText(firstSlide.title))
		})
	}
	for (const contentSlide of restSlides) {
		automizer.addSlide("root", CONTENT_SLIDE_SOURCE_INDEX, (slide) => {
			slide.modifyElement(TITLE_SHAPE_NAME, modify.setText(contentSlide.title))
			slide.modifyElement(BODY_SHAPE_NAME, ModifyTextHelper.setMultiText(toParagraphs(contentSlide.body)))
		})
	}

	await automizer.write(outputFilename)
	const outputPath = path.join(outputDir, outputFilename)
	try {
		return await readFile(outputPath)
	} finally {
		await rm(outputPath, { force: true })
	}
}
