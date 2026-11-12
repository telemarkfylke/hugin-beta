import type { FileUsage, VectorStoreFile } from "./types"

/** The four ways a file can be used by bots - the choices of the dropdown in the file list, in order. */
export type FileUsageChoice = "disabled" | "content" | "search" | "searchAndContent"

export const FILE_USAGE_CHOICES: { choice: FileUsageChoice; label: string; usage: FileUsage }[] = [
	{ choice: "disabled", label: "Deaktivert", usage: { search: false, fullText: false } },
	{ choice: "content", label: "Fil-innhold", usage: { search: false, fullText: true } },
	{ choice: "search", label: "Søk", usage: { search: true, fullText: false } },
	{ choice: "searchAndContent", label: "Søkbar + Fil-innhold", usage: { search: true, fullText: true } }
]

export function usageChoice(usage: FileUsage): FileUsageChoice {
	if (usage.search) return usage.fullText ? "searchAndContent" : "search"
	return usage.fullText ? "content" : "disabled"
}

export function isDone(file: VectorStoreFile): boolean {
	return file.status.toLowerCase() === "done"
}

// Same rule as ragservice's isIndexed: old files have no `indexed` and were always indexed once done
export function isFileIndexed(file: VectorStoreFile): boolean {
	if (file.indexed === undefined) return isDone(file)
	return file.indexed !== false
}

// Ragservice always sends the effective usage; the fallback (same default as ragservice's) only covers a
// ragservice older than per-file usage, so the file list keeps working whichever is deployed first.
export function fileUsage(file: VectorStoreFile): FileUsage {
	return (file.usage as FileUsage | undefined) ?? { search: isFileIndexed(file), fullText: false }
}

/** Uploaded before file storage existed: only its chunks exist, so it can be searched and nothing else. */
export function isOriginalMissing(file: VectorStoreFile): boolean {
	return !file.original
}

/**
 * Why a choice can't be picked for this file right now, or null when it can. Mirrors what ragservice refuses (409),
 * so the dropdown shows it up front instead of failing after the pick.
 */
export function usageChoiceBlocker(file: VectorStoreFile, usage: FileUsage): string | null {
	if (usage.search && !isFileIndexed(file)) return "Indekser filen først"
	if (usage.fullText && !file.text) return "Originalen mangler - last opp filen på nytt"
	return null
}

/** Bot-relevant size: whole-file content is what fills a bot's context, so pages say more than bytes. */
export const CHARACTERS_PER_PAGE = 3000

export function approximatePages(characters: number): number {
	return Math.max(1, Math.round(characters / CHARACTERS_PER_PAGE))
}
