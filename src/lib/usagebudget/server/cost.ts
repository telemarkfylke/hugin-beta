import type { ModelConfig } from "$lib/server/models/types"
import { AFFILIATIONS, type AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatResponseUsage, VendorId } from "$lib/types/chat"
import type { ChatInputItem } from "$lib/types/chat-item"
import type { HourDayBudget, ModelPrice, UsageLimits } from "$lib/usagebudget/types"

// For a model without a price in the DB ("model-prices", edited on /admin/ratelimits), or one that
// isn't in the catalogue at all (vendor agents have no model). Deliberately ~2x the priciest model we
// run - a missing price must never mean "free".
export const UNKNOWN_MODEL_PRICE: ModelPrice = { inputPerMillion: 4, outputPerMillion: 20 }

// By brukertype (affiliation) only - Hugin roles (admin etc.) decide what you may change, not how much
// you may use. Several brukertyper: the most generous one. None: the student budget.
export const usageBudgetFor = (user: AuthenticatedPrincipal, budgets: UsageLimits["budgets"]): HourDayBudget => {
	const own = AFFILIATIONS.filter((affiliation) => user.affiliations.includes(affiliation)).map((affiliation) => budgets[affiliation])
	if (own.length === 0) {
		return budgets.student
	}
	return { perHourUsd: Math.max(...own.map((b) => b.perHourUsd)), perDayUsd: Math.max(...own.map((b) => b.perDayUsd)) }
}

// Resolved configs carry the provider model id (e.g. "gpt-6-sol"), not the catalogue key, so look the
// catalogue key up by vendor + providerModel - the same pair the vendor SDK call is actually made with -
// and price it by that key.
export const modelPriceFor = (modelConfig: ModelConfig, priceByModel: Record<string, ModelPrice>, vendorId: VendorId, providerModel: string | undefined): ModelPrice => {
	const entry = Object.entries(modelConfig.MODELS).find(([, m]) => m.vendor === vendorId && m.providerModel === providerModel)
	return (entry && priceByModel[entry[0]]) || UNKNOWN_MODEL_PRICE
}

// Tokens per million, plus the per-call web search fee on top
export const usageCostUsd = (price: ModelPrice, usage: ChatResponseUsage, webSearchCallPriceUsd: number): number =>
	(usage.inputTokens * price.inputPerMillion + usage.outputTokens * price.outputPerMillion) / 1_000_000 + (usage.webSearchCalls ?? 0) * webSearchCallPriceUsd

// ~4 characters per token - only used when a stream ends without reporting usage (client aborted,
// vendor error), so the input the vendor already billed for still counts against the budget.
export const estimateInputUsage = (texts: string[]): ChatResponseUsage => {
	const inputTokens = Math.ceil(texts.reduce((sum, text) => sum + text.length, 0) / 4)
	return { inputTokens, outputTokens: 0, totalTokens: inputTokens }
}

// Every text the vendor is billed for as input - for estimateInputUsage. Attachments are left out:
// their base64 length says little about their token count.
export const requestTexts = (instructions: string | undefined, inputs: ChatInputItem[]): string[] => [
	instructions ?? "",
	...inputs.flatMap((item) => item.content.flatMap((c) => ("text" in c ? [c.text] : [])))
]
