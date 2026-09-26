// Removes style values Mermaid can't parse but models like to emit (SVG pattern/gradient references such as
// fill:url(#diagonalHatch)). The rest of the style line is kept; a style/classDef line left with no
// properties at all is dropped, since an empty one is a parse error too.
const URL_PROPERTY = /(^|,)\s*[\w-]+\s*:\s*url\([^)]*\)\s*(?=,|$)/g
const STYLE_LINE = /^(\s*(?:style|classDef)\s+\S+\s+)(.*)$/

export const sanitizeMermaid = (code: string): string => {
	return code
		.split("\n")
		.flatMap((line) => {
			const match = STYLE_LINE.exec(line)
			if (!match) return [line]
			const [, head, props] = match
			const cleaned = (props ?? "")
				.replace(URL_PROPERTY, "")
				.replace(/^\s*,\s*/, "")
				.trim()
			return cleaned ? [`${head}${cleaned}`] : []
		})
		.join("\n")
}
