import type { RequestHandler } from "@sveltejs/kit"
import ExcelJS from "exceljs"
import { getStatsStore } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { apiRequestMiddleware } from "$lib/server/middleware/http-request"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { ApiNextFunction } from "$lib/types/middleware/http-request"
import { getAuthorizedChatConfig, parseDateRange } from "../shared"

const statsStore = getStatsStore()

// Excel worksheet names: max 31 chars, and : \ / ? * [ ] are illegal - strip those, then
// deduplicate case-insensitively (Excel sheet names collide regardless of case) by appending a
// counter, e.g. if two author-defined categories sanitize down to the same name, or a category
// happens to be named the same as one of our own fixed sheets ("Statistikk"/FALLBACK_CATEGORY).
function sanitizeSheetName(name: string, usedNames: Set<string>): string {
	const base = (name.replace(/[:\\/?*[\]]/g, " ").trim() || "Kategori").slice(0, 31)

	let candidate = base
	let suffix = 2
	while (usedNames.has(candidate.toLowerCase())) {
		const suffixText = ` (${suffix})`
		candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`
		suffix++
	}
	usedNames.add(candidate.toLowerCase())
	return candidate
}

function sanitizeFileNamePart(name: string): string {
	return name.replace(/[^\w-]+/g, "_")
}

// GET /api/chatconfigs/[_id]/stats/export?from=...&to=... - the same data the Statistikk tab shows,
// as a downloadable .xlsx: one sheet with category totals, one sheet per author-defined category
// with its daily trend, and a last sheet listing the raw "Ukategorisert" samples (see
// UncategorizedSample) for offline review/pivoting.
const exportStats: ApiNextFunction = async ({ requestEvent, user }) => {
	if (!user.userId) {
		throw new HTTPError(400, "userId is required")
	}
	if (!requestEvent) {
		throw new HTTPError(400, "No request event")
	}

	const chatConfigId = requestEvent.params._id
	if (!chatConfigId) {
		throw new HTTPError(400, "_id parameter is required")
	}

	const chatConfig = await getAuthorizedChatConfig(chatConfigId, user)
	const { from, to } = parseDateRange(requestEvent.url.searchParams)

	const workbook = new ExcelJS.Workbook()
	workbook.creator = "Hugin"
	workbook.created = new Date()

	const usedSheetNames = new Set<string>()

	const totalsSheet = workbook.addWorksheet(sanitizeSheetName("Statistikk", usedSheetNames))
	totalsSheet.columns = [
		{ header: "Kategori", key: "category", width: 32 },
		{ header: "Antall", key: "count", width: 12 }
	]
	totalsSheet.addRows(await statsStore.getCategoryStats(chatConfigId, from, to))

	for (const category of chatConfig.categories ?? []) {
		const sheet = workbook.addWorksheet(sanitizeSheetName(category, usedSheetNames))
		sheet.columns = [
			{ header: "Dato", key: "date", width: 14 },
			{ header: "Antall", key: "count", width: 12 }
		]
		sheet.addRows(await statsStore.getCategoryStatsOverTime(chatConfigId, category, from, to))
	}

	// Not a count like the sheets above - a raw sampled list of AI-guessed topics (see
	// UncategorizedSample), so a bot author can review unanticipated question types offline.
	const uncategorizedSheet = workbook.addWorksheet(sanitizeSheetName(FALLBACK_CATEGORY, usedSheetNames))
	uncategorizedSheet.columns = [
		{ header: "Dato", key: "date", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
		{ header: "Tema (KI-gjettet, ikke eksakt spørsmålstekst)", key: "suggestedTopic", width: 50 }
	]
	uncategorizedSheet.addRows(await statsStore.getUncategorizedSamples(chatConfigId, from, to))

	const buffer = await workbook.xlsx.writeBuffer()
	const fileName = `statistikk-${sanitizeFileNamePart(chatConfig.name)}-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.xlsx`

	return {
		isAuthorized: true,
		response: new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": `attachment; filename="${fileName}"`
			}
		})
	}
}

export const GET: RequestHandler = async (requestEvent) => {
	return apiRequestMiddleware(requestEvent, exportStats)
}
