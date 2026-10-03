import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Automizer, ModifyTextHelper } from "pptx-automizer"
import type { ParsedSlide } from "./parse-slides-for-export"
import { getPresentationTemplatePath } from "./template-path"

const TITLE_SLIDE_SOURCE_INDEX = 1
const CONTENT_SLIDE_SOURCE_INDEX = 7

// The template ships 172 slideLayouts across 4 slideMasters (one per color theme), all reachable
// through the same "root" alias regardless of which slide/master they came from — no explicit
// addMaster() import is needed. Index 10 is slideMaster1's "Tittel og innhold 1 kolonne" layout
// (single content column), counted 1-based through the template's own slideLayouts in file order.
// Re-derive this by generating output, unzipping it, and checking which ppt/slideLayoutN.xml a
// content slide's ppt/slides/_rels/slideN.xml.rels points to, if the template is ever replaced.
const CONTENT_SLIDE_LAYOUT_INDEX = 10

// A single guard for "not a sane amount of slides to build": zero slides is undefined behavior
// downstream (no title slide to seed the deck), and an unbounded slide count is a real
// process-OOM vector since Automizer's per-slide memory cost scales roughly linearly. 200 is
// generous for any real presentation while keeping worst-case memory in the tens of MB.
const MAX_SLIDE_COUNT = 200

// These must match the exact PowerPoint shape names (Home > Arrange > Selection Pane) in the real
// Telemark fylkeskommune template at getPresentationTemplatePath() (converted from
// docs/ppt_templates/telemark_powerpointmal_bm.potx).
//
// Layout choice: the title slide is sourced directly from the template's own slide 1, which
// already uses the "Forside - Kun tekst 1" cover layout. For content slides there is no existing
// slide using the clean single-column "Tittel og innhold 1 kolonne" layout (slides 1-9 are the
// template's own Norwegian "how to use this template" instructional slides, and the ones using a
// content layout all use a 2-column layout instead) - so a content slide is sourced from slide 7
// (the cleanest of the six 2-column instructional slides: exactly 3 shapes, no decorative
// images unlike slides 4/5/6/8) and then reassigned to the 1-column layout via useSlideLayout().
// Reassigning the layout does not remove the slide's own second-column shape
// (SECONDARY_CONTENT_SHAPE_NAME) - it still ships with real baked-in Norwegian instructional text
// (image-cropping tips), not just inert layout prompt text, so it is explicitly removed per slide
// to avoid leaking that text into every generated deck.
//
// The title slide's own two extra placeholders ("Plassholder for tekst 2"/"3") are genuinely
// empty in the template (no baked-in text) and are left untouched.
const TITLE_SHAPE_NAME = "Tittel 1"
const CONTENT_TITLE_SHAPE_NAME = "Tittel 2"
const BODY_SHAPE_NAME = "Plassholder for innhold 3"
const SECONDARY_CONTENT_SHAPE_NAME = "Plassholder for innhold 4"

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
		// The template's own 9 instructional slides are only unlisted from the output's slide list
		// (not deleted from the archive) by removeExistingSlides — without cleanup, they'd remain as
		// unused, unreferenced parts inside the output .pptx alongside the newly generated slides.
		cleanup: true
	})
	// The root template is also loaded a second time under the alias "root": pptx-automizer's
	// addSlide() resolves its `name` argument against templates loaded via `.load()`, not against
	// the root template set by `.loadRoot()` — with removeExistingSlides enabled, slides from the
	// root file are otherwise unreachable as sources. See pptx-automizer's "Sort output slides"
	// docs (AI-INSTRUCTOR.md) for this exact pattern.
	automizer.loadRoot(path.basename(templatePath)).load(path.basename(templatePath), "root")

	// Title text is set via ModifyTextHelper.setMultiText rather than modify.setText: the real
	// template's placeholders are genuinely empty (no <a:r> run, just an empty paragraph) since
	// they were never filled in inside PowerPoint, and modify.setText only replaces the text of an
	// existing run — against an empty placeholder it silently no-ops rather than erroring.
	// setMultiText builds a fresh paragraph/run from scratch regardless, which works either way.
	const [firstSlide, ...restSlides] = slides
	if (firstSlide) {
		automizer.addSlide("root", TITLE_SLIDE_SOURCE_INDEX, (slide) => {
			slide.modifyElement(TITLE_SHAPE_NAME, ModifyTextHelper.setMultiText([{ paragraph: { level: 0 }, text: firstSlide.title }]))
		})
	}
	for (const contentSlide of restSlides) {
		automizer.addSlide("root", CONTENT_SLIDE_SOURCE_INDEX, (slide) => {
			slide.useSlideLayout(CONTENT_SLIDE_LAYOUT_INDEX)
			slide.modifyElement(CONTENT_TITLE_SHAPE_NAME, ModifyTextHelper.setMultiText([{ paragraph: { level: 0 }, text: contentSlide.title }]))
			slide.modifyElement(BODY_SHAPE_NAME, ModifyTextHelper.setMultiText(toParagraphs(contentSlide.body)))
			// See the layout-choice comment above the shape-name constants: this shape carries the
			// source slide's own baked-in instructional text, not just inert layout prompt text.
			slide.removeElement(SECONDARY_CONTENT_SHAPE_NAME)
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
