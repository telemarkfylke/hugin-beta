import { logger } from "@vestfoldfylke/loglady"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { getUsageLimits } from "$lib/usagebudget/server/usage-limits"
import { appendFileContentToInstructions, appendRagContextToInstructions } from "./format-rag-context"
import { loadAttachedDocuments, planRagContext } from "./rag-file-content"
import { getRagStoreSearchInfos, languagesFromSearchInfos, type RagStoreLanguages, resolveRagAuth, searchRagStores } from "./rag-search"

type DatasourceContextParams = {
	instructions: string | undefined
	storeIds: string[]
	queryText: string
	user: AuthenticatedPrincipal
	graphToken: string | null
	/** Turns the question into a search query (e.g. resolving references). Left out: the question is searched as is. */
	rewriteQuery?: (storeLanguages: RagStoreLanguages[]) => Promise<string>
}

/**
 * Adds a bot's ragservice datasources to its instructions for one question: whole files first ("Fil-innhold",
 * within the per-bot size limit), then search matches from the searchable files - see rag-file-content.ts for which
 * file goes where. Shared by the chat and the embed route, so both treat datasources the same.
 *
 * `foundContext`: whether anything at all was added - false means the bot answers without its datasources.
 * Throws only when ragservice can't be reached at all; a failed search keeps the files already attached.
 */
export async function addDatasourceContext({
	instructions,
	storeIds,
	queryText,
	user,
	graphToken,
	rewriteQuery
}: DatasourceContextParams): Promise<{ instructions: string | undefined; foundContext: boolean }> {
	const auth = await resolveRagAuth(user, graphToken)
	const infos = await getRagStoreSearchInfos(storeIds, auth)
	const { maxFileContentCharacters } = await getUsageLimits()
	const plan = planRagContext(infos, maxFileContentCharacters)

	const { documents, omitted } = await loadAttachedDocuments(plan, auth)
	if (omitted.length > 0) {
		logger.warn("Datasource files left out of the context (too big for the limit, or unavailable): {files}", omitted.map((file) => file.name).join(", "))
	}
	let result = documents.length > 0 || omitted.length > 0 ? appendFileContentToInstructions(instructions, documents, omitted) : instructions

	let matchCount = 0
	if (plan.search.needed && queryText) {
		try {
			const query = rewriteQuery ? await rewriteQuery(languagesFromSearchInfos(infos)) : queryText
			const matches = await searchRagStores(storeIds, query, user, graphToken, plan.search.fileIds)
			matchCount = matches.length
			if (matches.length > 0) result = appendRagContextToInstructions(result, matches)
		} catch (error) {
			logger.errorException(error, "searchRagStores failed - continuing without search matches")
		}
	}

	return { instructions: result, foundContext: documents.length > 0 || matchCount > 0 }
}
