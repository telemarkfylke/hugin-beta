const STORAGE_KEY = "hugin_dismissed_spotlights"

function readDismissedIds(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		const parsed = raw ? JSON.parse(raw) : []
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

function writeDismissedIds(ids: string[]): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function isSpotlightDismissed(id: string): boolean {
	return readDismissedIds().includes(id)
}

export function dismissSpotlightPermanently(id: string): void {
	const ids = readDismissedIds()
	if (!ids.includes(id)) writeDismissedIds([...ids, id])
}

export function resetSpotlight(id: string): void {
	writeDismissedIds(readDismissedIds().filter((existing) => existing !== id))
}

export function resetAllSpotlights(): void {
	localStorage.removeItem(STORAGE_KEY)
}
