import type { CategoryCount, CategoryDateCount, UncategorizedSample } from "$lib/statsstore/types"

// Write-time, anonymous per-category question counts (see $lib/statsstore/types) - a pure event log
// with different access patterns (high-volume inserts, range-aggregated reads) and no relation to
// chat-config CRUD, so it gets its own store/folder rather than folding into IChatConfigStore.
export interface IStatsStore {
	recordQuestionCategory(agentId: string, category: string, date: Date, suggestedTopic?: string): Promise<void>
	getCategoryStats(agentId: string, from: Date, to: Date): Promise<CategoryCount[]>
	// Same underlying data as getCategoryStats, but bucketed per day (UTC) for a single category -
	// lets a bot author see how one category trends over the period, not just its period total.
	getCategoryStatsOverTime(agentId: string, category: string, from: Date, to: Date): Promise<CategoryDateCount[]>
	// All "Ukategorisert" samples within the range (newest first) - see UncategorizedSample for why
	// these aren't grouped/counted like a category. Bounded only by the caller's chosen date range,
	// same as every other query here.
	getUncategorizedSamples(agentId: string, from: Date, to: Date): Promise<UncategorizedSample[]>
}
