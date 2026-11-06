import { canViewUsageStatistics } from "$lib/authorization"
import { serverLoadRequestMiddleware } from "$lib/server/middleware/http-request"
import type { ServerLoadNextFunction } from "$lib/types/middleware/http-request"
import { getTodaysUsage } from "$lib/usagebudget/server/usage-stats"
import type { TodaysUsage } from "$lib/usagebudget/types"
import type { PageServerLoad } from "./$types"

type StatisticsPageData = { usage: TodaysUsage | null }

const statisticsLoad: ServerLoadNextFunction<StatisticsPageData> = async ({ user }) => {
	if (!canViewUsageStatistics(user)) {
		return { data: { usage: null }, isAuthorized: false }
	}
	return { data: { usage: await getTodaysUsage() }, isAuthorized: true }
}

export const load: PageServerLoad = async (requestEvent): Promise<StatisticsPageData> => {
	return serverLoadRequestMiddleware(requestEvent, statisticsLoad)
}
