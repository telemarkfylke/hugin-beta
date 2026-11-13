const DATA_URL_PATTERN = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*)(?:;[^,;]*)*;base64,/i

/**
 * Splits a base64 data URL (data:<mime>;base64,<data>, optional parameters before ;base64) into its
 * media type and bytes. Null for anything else - e.g. an empty or http(s) URL - which is then left alone.
 */
export const parseBase64DataUrl = (url: string): { mimeType: string; bytes: Uint8Array } | null => {
	const match = DATA_URL_PATTERN.exec(url)
	if (!match?.[1]) {
		return null
	}
	return { mimeType: match[1].toLowerCase(), bytes: new Uint8Array(Buffer.from(url.slice(match[0].length), "base64")) }
}
