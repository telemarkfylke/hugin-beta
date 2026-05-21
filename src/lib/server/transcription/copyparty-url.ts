export const isTrustedCopypartyUrl = (url: string, base: string): boolean => {
	try {
		const urlOrigin = new URL(url).origin
		const baseOrigin = new URL(base).origin
		return urlOrigin === baseOrigin
	} catch {
		return false
	}
}
