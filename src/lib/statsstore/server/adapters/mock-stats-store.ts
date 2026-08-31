import { type CategoryCount, type CategoryDateCount, FALLBACK_CATEGORY, type QuestionCategoryStat, type UncategorizedSample } from "$lib/statsstore/types"
import type { IStatsStore } from "./interface"

const mockQuestionCategoryStats: QuestionCategoryStat[] = []

export class MockStatsStore implements IStatsStore {
	async recordQuestionCategory(agentId: string, category: string, date: Date, suggestedTopic?: string): Promise<void> {
		mockQuestionCategoryStats.push(suggestedTopic ? { agentId, category, date, suggestedTopic } : { agentId, category, date })
	}

	async getCategoryStats(agentId: string, from: Date, to: Date): Promise<CategoryCount[]> {
		const countsByCategory = new Map<string, number>()
		for (const stat of mockQuestionCategoryStats) {
			if (stat.agentId !== agentId || stat.date < from || stat.date > to) continue
			countsByCategory.set(stat.category, (countsByCategory.get(stat.category) ?? 0) + 1)
		}
		return [...countsByCategory.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)
	}

	async getCategoryStatsOverTime(agentId: string, category: string, from: Date, to: Date): Promise<CategoryDateCount[]> {
		const countsByDate = new Map<string, number>()
		for (const stat of mockQuestionCategoryStats) {
			if (stat.agentId !== agentId || stat.category !== category || stat.date < from || stat.date > to) continue
			const dateKey = stat.date.toISOString().slice(0, 10)
			countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1)
		}
		return [...countsByDate.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
	}

	async getUncategorizedSamples(agentId: string, from: Date, to: Date): Promise<UncategorizedSample[]> {
		return mockQuestionCategoryStats
			.filter((stat) => stat.agentId === agentId && stat.category === FALLBACK_CATEGORY && stat.suggestedTopic && stat.date >= from && stat.date <= to)
			.sort((a, b) => b.date.getTime() - a.date.getTime())
			.map((stat) => ({ date: stat.date, suggestedTopic: stat.suggestedTopic as string }))
	}
}
