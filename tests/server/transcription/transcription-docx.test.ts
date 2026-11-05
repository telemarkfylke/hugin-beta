import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { buildTranscriptionDocx } from "$lib/server/transcription/transcription-docx"

const documentXml = async (bytes: Uint8Array): Promise<string> => {
	const zip = await JSZip.loadAsync(bytes)
	const file = zip.file("word/document.xml")
	if (!file) throw new Error("word/document.xml is missing")
	return file.async("string")
}

// Text of every <w:p> in order, so assertions don't depend on run splitting
const paragraphTexts = (xml: string): string[] =>
	[...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(([p]) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(([, t]) => t).join("")).filter((t) => t !== "")

const BASE = { fileName: "Styremøte <mars>.mp3", completedAt: "2026-11-05T10:15:00.000Z", durationSeconds: 125 }

describe("buildTranscriptionDocx", () => {
	it("is a Word document with a title, the source file and one paragraph per transcription paragraph", async () => {
		const bytes = await buildTranscriptionDocx({ ...BASE, text: "ignored when paragraphs exist", paragraphs: ["Første avsnitt.", "Andre & siste avsnitt."] })
		const texts = paragraphTexts(await documentXml(bytes))
		expect(texts[0]).toBe("Transkripsjon")
		expect(texts.some((t) => t.includes("Styremøte &lt;mars&gt;.mp3"))).toBe(true)
		expect(texts).toContain("Første avsnitt.")
		expect(texts).toContain("Andre &amp; siste avsnitt.")
		expect(texts.join("\n")).not.toContain("ignored when paragraphs exist")
	})

	it("splits the plain text on blank lines when there are no paragraphs", async () => {
		const bytes = await buildTranscriptionDocx({ ...BASE, text: "En.\n\nTo.\n\n\nTre.", paragraphs: [] })
		const texts = paragraphTexts(await documentXml(bytes))
		expect(texts).toEqual(expect.arrayContaining(["En.", "To.", "Tre."]))
	})

	it("marks the document as machine-generated", async () => {
		const bytes = await buildTranscriptionDocx({ ...BASE, text: "Hei.", paragraphs: [] })
		expect(paragraphTexts(await documentXml(bytes)).join("\n")).toContain("kvalitetssikre")
	})
})
