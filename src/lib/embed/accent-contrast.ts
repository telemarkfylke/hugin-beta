const hexToRgb = (hex: string): [number, number, number] => {
	const value = Number.parseInt(hex, 16)
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

// WCAG relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
const relativeLuminance = (hex: string): number => {
	const [r, g, b] = hexToRgb(hex).map((channel) => {
		const srgb = channel / 255
		return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

const contrastRatio = (luminanceA: number, luminanceB: number): number => {
	const lighter = Math.max(luminanceA, luminanceB)
	const darker = Math.min(luminanceA, luminanceB)
	return (lighter + 0.05) / (darker + 0.05)
}

// An admin can set the embed's accent colour to anything via ?accent=. Used as a solid button/header
// background, it needs foreground text that stays readable regardless of how light or dark that
// colour is - so pick whichever of black/white has the higher WCAG contrast ratio against it.
export const getAccentContrastText = (accentHex: string): "#ffffff" | "#000000" => {
	const luminance = relativeLuminance(accentHex)
	const contrastWithWhite = contrastRatio(luminance, 1)
	const contrastWithBlack = contrastRatio(luminance, 0)
	return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#000000"
}
