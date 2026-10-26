import type { ModelConfig, ModelPrice } from "$lib/server/models/types"
import type { AppRoles } from "$lib/types/app-config"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatResponseUsage, VendorId } from "$lib/types/chat"

export type UsageBudget = {
	perHourUsd: number
	perDayUsd: number
}

type BudgetRole = "ADMIN" | "EMPLOYEE" | "EDU_EMPLOYEE" | "STUDENT"
export type UsageBudgets = Record<BudgetRole, UsageBudget>

// Per-user spend caps in USD, by app role - USD because that's what the vendors' price lists use,
// so model prices are copied as-is with no exchange rate to keep current. A user with several roles
// gets the most generous one; a user with none of these roles gets STUDENT's. Two windows: the
// hourly cap stops a runaway script early, the daily cap bounds a whole night of it.
// Rough NOK at ~10.5: student 3/10 kr, employee 10/40 kr, admin 50/200 kr per hour/day.
// Defaults only - the USAGE_BUDGET env var overrides any of them, see parseUsageBudgets.
export const DEFAULT_USAGE_BUDGETS: UsageBudgets = {
	ADMIN: { perHourUsd: 5, perDayUsd: 20 },
	EMPLOYEE: { perHourUsd: 1, perDayUsd: 4 },
	EDU_EMPLOYEE: { perHourUsd: 1, perDayUsd: 4 },
	STUDENT: { perHourUsd: 0.3, perDayUsd: 1 }
}

const BUDGET_FIELDS = { hour: "perHourUsd", day: "perDayUsd" } as const

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

// USAGE_BUDGET env var, e.g. {"STUDENT":{"hour":0.3,"day":1},"ADMIN":{"hour":0.001}} - overrides only,
// merged per role and per field onto DEFAULT_USAGE_BUDGETS. Anything invalid (bad JSON, unknown role
// or field, a value that isn't a positive number) is skipped with a warning rather than thrown, so a
// typo in the deploy config can neither take the app down nor lift a cap.
export const parseUsageBudgets = (raw: string | undefined): { budgets: UsageBudgets; warnings: string[] } => {
	const budgets: UsageBudgets = structuredClone(DEFAULT_USAGE_BUDGETS)
	const warnings: string[] = []
	if (!raw?.trim()) {
		return { budgets, warnings }
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { budgets, warnings: ["USAGE_BUDGET is not valid JSON - using the defaults"] }
	}
	if (!isPlainObject(parsed)) {
		return { budgets, warnings: ["USAGE_BUDGET must be a JSON object - using the defaults"] }
	}

	for (const [role, override] of Object.entries(parsed)) {
		if (!Object.hasOwn(budgets, role)) {
			warnings.push(`USAGE_BUDGET: unknown role "${role}" ignored (known: ${Object.keys(budgets).join(", ")})`)
			continue
		}
		if (!isPlainObject(override)) {
			warnings.push(`USAGE_BUDGET.${role} must be an object like {"hour":1,"day":4} - ignored`)
			continue
		}
		for (const [field, value] of Object.entries(override)) {
			if (!Object.hasOwn(BUDGET_FIELDS, field)) {
				warnings.push(`USAGE_BUDGET.${role}: unknown field "${field}" ignored (known: hour, day)`)
				continue
			}
			if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
				warnings.push(`USAGE_BUDGET.${role}.${field} must be a positive number - ignored`)
				continue
			}
			budgets[role as BudgetRole][BUDGET_FIELDS[field as keyof typeof BUDGET_FIELDS]] = value
		}
	}
	return { budgets, warnings }
}

// For a model without a `price` in models.config.ts, or one that isn't in the catalogue at all
// (vendor agents have no model). Deliberately ~2x the priciest model we run - a missing price must
// never mean "free".
export const UNKNOWN_MODEL_PRICE: ModelPrice = { inputPerMillion: 4, outputPerMillion: 20 }

export const usageBudgetFor = (user: AuthenticatedPrincipal, appRoles: AppRoles, usageBudgets: UsageBudgets): UsageBudget => {
	const budgets = (Object.keys(usageBudgets) as BudgetRole[]).filter((role) => user.roles.includes(appRoles[role])).map((role) => usageBudgets[role])
	if (budgets.length === 0) {
		return usageBudgets.STUDENT
	}
	return { perHourUsd: Math.max(...budgets.map((b) => b.perHourUsd)), perDayUsd: Math.max(...budgets.map((b) => b.perDayUsd)) }
}

// Resolved configs carry the provider model id (e.g. "gpt-6-sol"), not the catalogue key, so look up
// by vendor + providerModel - the same pair the vendor SDK call is actually made with.
export const modelPriceFor = (modelConfig: ModelConfig, vendorId: VendorId, providerModel: string | undefined): ModelPrice => {
	const model = Object.values(modelConfig.MODELS).find((m) => m.vendor === vendorId && m.providerModel === providerModel)
	return model?.price ?? UNKNOWN_MODEL_PRICE
}

export const usageCostUsd = (price: ModelPrice, usage: ChatResponseUsage): number => (usage.inputTokens * price.inputPerMillion + usage.outputTokens * price.outputPerMillion) / 1_000_000

// ~4 characters per token - only used when a stream ends without reporting usage (client aborted,
// vendor error), so the input the vendor already billed for still counts against the budget.
export const estimateInputUsage = (texts: string[]): ChatResponseUsage => {
	const inputTokens = Math.ceil(texts.reduce((sum, text) => sum + text.length, 0) / 4)
	return { inputTokens, outputTokens: 0, totalTokens: inputTokens }
}
