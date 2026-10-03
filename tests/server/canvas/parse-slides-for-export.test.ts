import { describe, expect, it } from "vitest"
import { parseSlidesForExport } from "$lib/server/canvas/presentation/parse-slides-for-export"

describe("parseSlidesForExport", () => {
	it("parses a single slide with a heading and bullets", () => {
		const result = parseSlidesForExport("# Velkommen\n- Punkt en\n- Punkt to")
		expect(result).toEqual([
			{
				title: "Velkommen",
				body: [
					{ text: "Punkt en", bullet: true },
					{ text: "Punkt to", bullet: true }
				]
			}
		])
	})

	it("splits multiple slides on --- separators", () => {
		const result = parseSlidesForExport("# Slide 1\n- A\n---\n## Slide 2\n- B")
		expect(result).toEqual([
			{ title: "Slide 1", body: [{ text: "A", bullet: true }] },
			{ title: "Slide 2", body: [{ text: "B", bullet: true }] }
		])
	})

	it("leaves the title blank when no heading line is present", () => {
		const result = parseSlidesForExport("- Just a bullet, no heading")
		expect(result).toEqual([{ title: "", body: [{ text: "Just a bullet, no heading", bullet: true }] }])
	})

	it("treats non-bullet lines as plain (non-bulleted) body paragraphs", () => {
		const result = parseSlidesForExport("# Title\nJust a sentence.\nAnother sentence.")
		expect(result).toEqual([
			{
				title: "Title",
				body: [
					{ text: "Just a sentence.", bullet: false },
					{ text: "Another sentence.", bullet: false }
				]
			}
		])
	})

	it("takes only the first heading line as the title, folding later headings into the body", () => {
		const result = parseSlidesForExport("- A bullet before any heading\n# The Title\n## A second heading")
		expect(result).toEqual([
			{
				title: "The Title",
				body: [
					{ text: "A bullet before any heading", bullet: true },
					{ text: "## A second heading", bullet: false }
				]
			}
		])
	})

	it("returns an empty array for empty or whitespace-only input", () => {
		expect(parseSlidesForExport("")).toEqual([])
		expect(parseSlidesForExport("   \n\n  ")).toEqual([])
	})

	it("ignores blank lines within a slide", () => {
		const result = parseSlidesForExport("# Title\n\n- A\n\n- B\n")
		expect(result).toEqual([
			{
				title: "Title",
				body: [
					{ text: "A", bullet: true },
					{ text: "B", bullet: true }
				]
			}
		])
	})
})
