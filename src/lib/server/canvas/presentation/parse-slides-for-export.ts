const HEADING_PATTERN = /^#{1,2}\s+(.*)$/
const BULLET_PATTERN = /^[-*]\s+(.*)$/

export type SlideBodyLine = {
	text: string
	bullet: boolean
}

export type ParsedSlide = {
	title: string
	body: SlideBodyLine[]
}

const parseSlideSection = (section: string): ParsedSlide => {
	const lines = section
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	let title = ""
	let titleFound = false
	const body: SlideBodyLine[] = []

	for (const line of lines) {
		if (!titleFound) {
			const headingMatch = line.match(HEADING_PATTERN)
			if (headingMatch) {
				title = headingMatch[1] ?? ""
				titleFound = true
				continue
			}
		}
		const bulletMatch = line.match(BULLET_PATTERN)
		if (bulletMatch) {
			body.push({ text: bulletMatch[1] ?? "", bullet: true })
		} else {
			body.push({ text: line, bullet: false })
		}
	}

	return { title, body }
}

export const parseSlidesForExport = (slidesMarkdown: string): ParsedSlide[] => {
	return slidesMarkdown
		.split(/^\s*---\s*$/m)
		.map((section) => section.trim())
		.filter((section) => section.length > 0)
		.map(parseSlideSection)
}
