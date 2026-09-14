import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { buildPresentation } from "$lib/server/canvas/presentation/build-presentation"
import type { ParsedSlide } from "$lib/server/canvas/presentation/parse-slides-for-export"

// pptx-automizer numbers newly-written slide parts by continuing after however many slides
// already physically exist in the loaded root template — it does not renumber down to
// slide1.xml/slide2.xml. Our root template (built by Task 7) already ships with 2 slides, so
// the slides this test generates land in files named e.g. slide3.xml/slide4.xml, not
// slide1.xml/slide2.xml (their relationship ids also get a "-created" suffix). To assert
// against the real output we resolve the actual slide part paths from ppt/presentation.xml's
// slide list (in display order) via ppt/_rels/presentation.xml.rels, instead of assuming fixed
// file names.
const getOrderedSlidePaths = async (zip: JSZip): Promise<string[]> => {
	const presentationXml = await zip.file("ppt/presentation.xml")?.async("string")
	const relsXml = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string")
	if (!presentationXml || !relsXml) {
		throw new Error("Missing ppt/presentation.xml or its rels in the generated pptx")
	}

	const sldIdLstMatch = presentationXml.match(/<p:sldIdLst>([\s\S]*?)<\/p:sldIdLst>/)
	const sldIdLstBody = sldIdLstMatch?.[1] ?? ""
	const relIds = [...sldIdLstBody.matchAll(/r:id="([^"]+)"/g)].map((match) => match[1])

	const relTargets = new Map<string, string>()
	for (const match of relsXml.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
		relTargets.set(match[1] as string, match[2] as string)
	}

	return relIds.map((relId) => {
		const target = relId ? relTargets.get(relId) : undefined
		if (!target) {
			throw new Error(`No relationship target found for ${relId}`)
		}
		return `ppt/${target}`
	})
}

describe("buildPresentation", () => {
	it("produces a pptx with one slide per parsed slide, containing the title and bullet text", async () => {
		const slides: ParsedSlide[] = [
			{ title: "Velkommen", body: [] },
			{
				title: "Om oss",
				body: [
					{ text: "Punkt en", bullet: true },
					{ text: "Punkt to", bullet: true }
				]
			}
		]

		const buffer = await buildPresentation(slides)
		expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK") // zip file signature

		const zip = await JSZip.loadAsync(buffer)
		const slidePaths = await getOrderedSlidePaths(zip)
		expect(slidePaths).toHaveLength(2)

		const slide1Xml = await zip.file(slidePaths[0] as string)?.async("string")
		const slide2Xml = await zip.file(slidePaths[1] as string)?.async("string")

		expect(slide1Xml).toContain("Velkommen")
		expect(slide2Xml).toContain("Om oss")
		expect(slide2Xml).toContain("Punkt en")
		expect(slide2Xml).toContain("Punkt to")
	})
})
