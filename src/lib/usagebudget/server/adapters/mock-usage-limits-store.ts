import type { ModelPrice, UpdatedBy, UsageLimits } from "$lib/usagebudget/types"
import type { IUsageLimitsStore, RawModelPrice, RawUsageLimits } from "./interface"

// Pre-seeded with the values Hugin had while they were hardcoded (same as scripts/seed-usage-limits.mjs),
// so MOCK_DB=true local dev and the tests behave like a seeded environment. Mock data only.
const mockLimits: { values: UsageLimits; updatedAt: Date | null; updatedBy: UpdatedBy | null } = {
	values: {
		budgets: {
			employee: { perHourUsd: 1, perDayUsd: 4 },
			edu_employee: { perHourUsd: 1, perDayUsd: 4 },
			student: { perHourUsd: 0.3, perDayUsd: 1 }
		},
		anonymousEmbed: { perHourUsd: 1, perDayUsd: 5 },
		maxConcurrentCalls: 3,
		webSearchCallPriceUsd: 0.03,
		embedRateLimits: { perIpPerMinute: 20, perIpPerDay: 200, perBotPerDay: null }
	},
	updatedAt: null,
	updatedBy: null
}

const OLLAMA_PRICE = { inputPerMillion: 0.01, outputPerMillion: 0.01 }

const mockPrices = new Map<string, { price: ModelPrice; updatedAt: Date | null; updatedBy: UpdatedBy | null }>(
	Object.entries({
		"gpt-5.6-terra": { inputPerMillion: 2, outputPerMillion: 12 },
		"gpt-6-sol": { inputPerMillion: 2, outputPerMillion: 10 },
		"gpt-6-luna": { inputPerMillion: 0.1, outputPerMillion: 0.5 },
		"gpt-5.6-luna": { inputPerMillion: 0.2, outputPerMillion: 1.2 },
		"mistral-large": { inputPerMillion: 0.5, outputPerMillion: 1.5 },
		"ollama-llama3": OLLAMA_PRICE,
		"ollama-mistral": OLLAMA_PRICE,
		"ollama-gemma": OLLAMA_PRICE,
		"ollama-deepseek-r1": OLLAMA_PRICE,
		normistral: OLLAMA_PRICE
	}).map(([model, price]) => [model, { price, updatedAt: null, updatedBy: null }])
)

export class MockUsageLimitsStore implements IUsageLimitsStore {
	async getUsageLimits(): Promise<RawUsageLimits | null> {
		return { values: structuredClone(mockLimits.values), updatedAt: mockLimits.updatedAt, updatedBy: mockLimits.updatedBy }
	}

	async saveUsageLimits(limits: UsageLimits, updatedBy: UpdatedBy): Promise<void> {
		mockLimits.values = structuredClone(limits)
		mockLimits.updatedAt = new Date()
		mockLimits.updatedBy = updatedBy
	}

	async getModelPrices(): Promise<RawModelPrice[]> {
		return [...mockPrices].map(([model, entry]) => ({ model, ...entry.price, updatedAt: entry.updatedAt, updatedBy: entry.updatedBy }))
	}

	async setModelPrice(model: string, price: ModelPrice, updatedBy: UpdatedBy): Promise<void> {
		mockPrices.set(model, { price: { ...price }, updatedAt: new Date(), updatedBy })
	}

	async deleteModelPrice(model: string): Promise<void> {
		mockPrices.delete(model)
	}
}
