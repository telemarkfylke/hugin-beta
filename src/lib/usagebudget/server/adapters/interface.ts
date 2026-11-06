import type { ModelPrice, UpdatedBy, UsageLimits } from "$lib/usagebudget/types"

// What the DB holds, unvalidated - a hand-edited document can be anything. Validated (field by field,
// falling back to the code floor) in $lib/usagebudget/server/usage-limits, never trusted as-is.
export type RawUsageLimits = {
	values: Partial<Record<keyof UsageLimits, unknown>>
	updatedAt: Date | null
	updatedBy: UpdatedBy | null
}

export type RawModelPrice = {
	model: string
	inputPerMillion: unknown
	outputPerMillion: unknown
	updatedAt: Date | null
	updatedBy: UpdatedBy | null
}

// Usage limits + model prices (see $lib/usagebudget/types). Read through the cache in
// $lib/usagebudget/server/usage-limits, never directly - that's what keeps it off the hot path.
export interface IUsageLimitsStore {
	// null when nothing has been saved in this environment yet
	getUsageLimits(): Promise<RawUsageLimits | null>
	saveUsageLimits(limits: UsageLimits, updatedBy: UpdatedBy): Promise<void>
	getModelPrices(): Promise<RawModelPrice[]>
	setModelPrice(model: string, price: ModelPrice, updatedBy: UpdatedBy): Promise<void>
	// The model is then priced as UNKNOWN_MODEL_PRICE
	deleteModelPrice(model: string): Promise<void>
}
