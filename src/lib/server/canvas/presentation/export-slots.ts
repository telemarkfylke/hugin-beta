import { HTTPError } from "$lib/server/middleware/http-error"

// An export costs ~1 s and ~250 MB however small the deck is (the template is unpacked twice), and
// calls no model, so neither the usage budget nor acquireCallSlot covers it - this caps how many run
// at once. In memory on purpose: it's this instance's memory being protected.
const MAX_EXPORTS_PER_USER = 1
const MAX_EXPORTS_TOTAL = 3

const inFlightByUser = new Map<string, number>()
let inFlightTotal = 0

// Returns the release function - call it exactly once, when the export is done (or failed)
export const acquireExportSlot = (userId: string): (() => void) => {
	const userCount = inFlightByUser.get(userId) ?? 0
	if (userCount >= MAX_EXPORTS_PER_USER) {
		throw new HTTPError(429, "Vent til forrige eksport er ferdig.")
	}
	if (inFlightTotal >= MAX_EXPORTS_TOTAL) {
		throw new HTTPError(429, "Mange eksporterer akkurat nå. Prøv igjen om litt.")
	}
	inFlightByUser.set(userId, userCount + 1)
	inFlightTotal++

	let released = false
	return () => {
		if (released) return
		released = true
		inFlightTotal--
		const remaining = (inFlightByUser.get(userId) ?? 1) - 1
		if (remaining > 0) {
			inFlightByUser.set(userId, remaining)
		} else {
			inFlightByUser.delete(userId)
		}
	}
}
