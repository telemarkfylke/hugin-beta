import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx"

export type TranscriptionDocxInput = {
	fileName: string
	completedAt: string
	durationSeconds?: number | null
	text: string
	paragraphs: string[]
}

const formatDuration = (seconds: number): string => {
	const total = Math.round(seconds)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	return h > 0 ? `${h} t ${m} min ${s} s` : m > 0 ? `${m} min ${s} s` : `${s} s`
}

const formatDate = (iso: string): string => {
	const date = new Date(iso)
	return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })
}

/** The transcription text as paragraphs: tale-til-notat's own paragraphs when present, else the text split on blank lines. */
const bodyParagraphs = ({ text, paragraphs }: TranscriptionDocxInput): string[] => {
	const source = paragraphs.length > 0 ? paragraphs : text.split(/\n\s*\n/)
	return source.map((p) => p.trim()).filter((p) => p !== "")
}

/** Builds the Word document users download for a finished transcription. Hugin builds it itself from the callback text. */
export const buildTranscriptionDocx = async (input: TranscriptionDocxInput): Promise<Uint8Array> => {
	const meta = [`Fil: ${input.fileName}`, `Transkribert: ${formatDate(input.completedAt)}`]
	if (input.durationSeconds != null) meta.push(`Varighet: ${formatDuration(input.durationSeconds)}`)

	const document = new Document({
		creator: "Hugin – Tale til notat",
		title: `Transkripsjon – ${input.fileName}`,
		sections: [
			{
				children: [
					new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Transkripsjon")] }),
					new Paragraph({ children: [new TextRun({ text: meta.join(" · "), italics: true })] }),
					new Paragraph({
						children: [new TextRun({ text: "Automatisk transkribert med KI (Nasjonalbibliotekets nb-whisper). Teksten kan inneholde feil – kvalitetssikre før bruk.", italics: true })]
					}),
					...bodyParagraphs(input).map((text) => new Paragraph({ children: [new TextRun(text)] }))
				]
			}
		]
	})
	return new Uint8Array(await Packer.toBuffer(document))
}
