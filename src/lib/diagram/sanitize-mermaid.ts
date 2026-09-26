// Removes style values Mermaid can't parse but models like to emit (SVG pattern/gradient references such as
// fill:url(#diagonalHatch)). The rest of the style line is kept; a style line left with no properties at all
// is dropped, since an empty one is a parse error too. Covers style, classDef and linkStyle lines; properties
// may be separated by "," or ";" and carry "!important".
const STYLE_LINE = /^(\s*(?:style\s+\S+|classDef\s+\S+|linkStyle\s+[\w,]+)\s+)(\S.*)$/
const URL_PROPERTY = /[\w-]+\s*:\s*url\([^)]*\)[^,;]*/

export const sanitizeMermaid = (code: string): string => {
	return code
		.split("\n")
		.flatMap((line) => {
			const match = STYLE_LINE.exec(line)
			if (!match || !URL_PROPERTY.test(line)) return [line]
			const [, head, props] = match
			const separator = props?.includes(";") && !props.includes(",") ? ";" : ","
			const kept = (props ?? "")
				.split(/[,;]/)
				.map((prop) => prop.trim())
				.filter((prop) => prop && !URL_PROPERTY.test(prop))
			return kept.length > 0 ? [`${head}${kept.join(separator)}`] : []
		})
		.join("\n")
}

// Mermaid renders <br> in labels as a line break, but the Excalidraw converter keeps the tag as literal text.
// Turn <br> into a real newline and drop simple inline formatting tags the model likes to add.
const BR_TAG = /<br\s*\/?>/gi
const INLINE_TAG = /<\/?(?:b|i|u|em|strong|small|sup|sub|span)(?:\s[^>]*)?>/gi

export const cleanLabelText = (text: string): string => text.replace(BR_TAG, "\n").replace(INLINE_TAG, "")

// Applies cleanLabelText to converter skeletons: free text elements and the labels of shapes and arrows
export const cleanSkeletonText = <T extends { type: string; text?: string; label?: { text?: string } }>(skeleton: T): T => {
	if (typeof skeleton.text === "string") return { ...skeleton, text: cleanLabelText(skeleton.text) }
	if (skeleton.label && typeof skeleton.label.text === "string") return { ...skeleton, label: { ...skeleton.label, text: cleanLabelText(skeleton.label.text) } }
	return skeleton
}
