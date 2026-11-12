import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import type { StoreSearchInfo } from "$lib/ragservice/types"
import type { RagAuth, RagStoreSearchInfo } from "./rag-search"

/**
 * Which datasource files a bot gets whole ("Fil-innhold") and which it searches, decided per question from each
 * file's usage (set per file in the datasource's file list) and one size limit per bot (maxFileContentCharacters,
 * on /admin/ratelimits):
 *
 * 1. File content only: always attached, in a fixed order, as long as it fits. One that doesn't fit is left out -
 *    never cut short - and named in `omitted`, so the bot can tell the user.
 * 2. Searchable + file content: attached whole from the smallest up while there is room, the rest are searched.
 *    So a short instruction comes along whole, while a huge law is searched instead.
 * 3. Search only: searched, as always.
 *
 * Everything here is read with the chatting user's own access (search access), and ragservice decides per file
 * what that user may get - a file only shows up as attachable when ragservice says its usage allows it.
 */

/** Manually added chunks carry this as their fileId in ragservice; a file-scoped search must name it to keep them. */
const MANUAL_CHUNKS_FILE_ID = "Manual upload"

export type PlannedFile = { storeId: string; fileId: string; name: string; characters: number }

export type RagContextPlan = {
	attached: PlannedFile[]
	omitted: PlannedFile[]
	/**
	 * Whether to run a search at all, and on which files: undefined = no file filter (ragservice's own usage filter
	 * is enough). A list only when some searchable file was attached whole, so the search doesn't repeat it as
	 * chunks.
	 */
	search: { needed: boolean; fileIds?: string[] }
}

type InfoFile = StoreSearchInfo["files"][number]

const byName = (a: PlannedFile, b: PlannedFile) => a.name.localeCompare(b.name, "nb") || a.fileId.localeCompare(b.fileId)

export function planRagContext(infos: RagStoreSearchInfo[], maxCharacters: number): RagContextPlan {
	const contentOnly: PlannedFile[] = []
	const searchableContent: PlannedFile[] = []
	const searchOnlyIds: string[] = []

	for (const { storeId, info } of infos) {
		for (const file of info?.files ?? []) {
			const planned = toPlanned(storeId, file)
			if (file.usage.fullText && planned && !file.usage.search) contentOnly.push(planned)
			else if (file.usage.fullText && planned && file.usage.search) searchableContent.push(planned)
			else if (file.usage.search) searchOnlyIds.push(file.id)
		}
	}

	const attached: PlannedFile[] = []
	const omitted: PlannedFile[] = []
	let used = 0

	// Fixed order (store as configured, then name), so the same files always come in the same order - stable
	// context is what lets the vendors' prompt caching make repeated questions cheaper
	const storeOrder = new Map(infos.map(({ storeId }, index) => [storeId, index]))
	const byStoreThenName = (a: PlannedFile, b: PlannedFile) => (storeOrder.get(a.storeId) ?? 0) - (storeOrder.get(b.storeId) ?? 0) || byName(a, b)

	for (const file of [...contentOnly].sort(byStoreThenName)) {
		if (used + file.characters <= maxCharacters) {
			attached.push(file)
			used += file.characters
		} else {
			omitted.push(file)
		}
	}

	// A store that couldn't be read is still searched, unfiltered as before. A file filter listing only the readable
	// stores' files would shut it out, so then no searchable file is attached whole - they are all searched instead,
	// and no filter is needed to keep them from coming back as chunks too
	const anyStoreUnreadable = infos.some(({ info }) => info === null)

	const searchedInstead: string[] = []
	let attachedSearchable = false
	for (const file of [...searchableContent].sort((a, b) => a.characters - b.characters || byName(a, b))) {
		if (!anyStoreUnreadable && used + file.characters <= maxCharacters) {
			attached.push(file)
			used += file.characters
			attachedSearchable = true
		} else {
			searchedInstead.push(file.fileId)
		}
	}

	const searchFileIds = [...searchOnlyIds, ...searchedInstead]
	const needed = searchFileIds.length > 0 || anyStoreUnreadable

	return {
		attached: attached.sort(byStoreThenName),
		omitted,
		search: { needed, ...(attachedSearchable ? { fileIds: [...searchFileIds, MANUAL_CHUNKS_FILE_ID] } : {}) }
	}
}

// Only files whose text ragservice will give this user (usage.fullText - then it also sends the size)
function toPlanned(storeId: string, file: InfoFile): PlannedFile | null {
	if (!file.usage.fullText || file.characters === undefined) return null
	return { storeId, fileId: file.id, name: file.name, characters: file.characters }
}

// A file's text only changes when it is indexed again with a new parse, which also changes its size - so storeId,
// fileId and size together identify one version. Safe to share across users: a file only gets here when ragservice
// has just told this user (searchinfo) that they may have its text.
const TEXT_CACHE_TTL_MS = 10 * 60_000
const TEXT_CACHE_MAX_CHARACTERS = 20_000_000
const textCache = new Map<string, { text: string; cachedAt: number }>()

const cacheKey = (file: PlannedFile) => `${file.storeId}/${file.fileId}/${file.characters}`

function cachedText(file: PlannedFile): string | null {
	const key = cacheKey(file)
	const hit = textCache.get(key)
	if (!hit) return null
	if (Date.now() - hit.cachedAt > TEXT_CACHE_TTL_MS) {
		textCache.delete(key)
		return null
	}
	return hit.text
}

function cacheText(file: PlannedFile, text: string): void {
	textCache.set(cacheKey(file), { text, cachedAt: Date.now() })
	let total = 0
	for (const entry of textCache.values()) total += entry.text.length
	// Oldest first (Map keeps insertion order) until back under the cap
	for (const [key, entry] of textCache) {
		if (total <= TEXT_CACHE_MAX_CHARACTERS) break
		textCache.delete(key)
		total -= entry.text.length
	}
}

export function clearFileTextCache(): void {
	textCache.clear()
}

async function fetchFileText(file: PlannedFile, auth: RagAuth): Promise<string | null> {
	const cached = cachedText(file)
	if (cached !== null) return cached
	try {
		const res = await fetch(`${env.RAGSERVICE_URL}/api/stores/${file.storeId}/files/${file.fileId}/text`, {
			headers: { authorization: `Bearer ${auth.ragToken}`, "x-user-id": auth.userId, "x-user-groups": auth.groups.join(",") }
		})
		if (!res.ok) {
			logger.warn("Could not fetch file content {fileId} from store {storeId}: {status}", file.fileId, file.storeId, res.status)
			return null
		}
		const text = await res.text()
		cacheText(file, text)
		return text
	} catch (error) {
		logger.errorException(error, "Fetching file content failed")
		return null
	}
}

export type AttachedDocument = { name: string; text: string }

/**
 * The attached files' texts, in plan order. A file whose text can't be fetched right now moves to `omitted`, so the
 * bot is told it's missing rather than answering as if it had read it.
 */
export async function loadAttachedDocuments(plan: RagContextPlan, auth: RagAuth): Promise<{ documents: AttachedDocument[]; omitted: PlannedFile[] }> {
	const texts = await Promise.all(plan.attached.map((file) => fetchFileText(file, auth)))
	const documents: AttachedDocument[] = []
	const omitted = [...plan.omitted]
	plan.attached.forEach((file, index) => {
		const text = texts[index]
		if (text === null || text === undefined) omitted.push(file)
		else documents.push({ name: file.name, text })
	})
	return { documents, omitted }
}
