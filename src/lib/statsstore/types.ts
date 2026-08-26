// Write-time, anonymous usage statistics for chatbots - see $lib/server/categorize-question and
// the recordQuestionCategoryStat hook in /api/chat. Deliberately NOT tied to conversation storage:
// most chats are (forced) incognito, so this is the only trace of "what do people actually ask"
// that ever gets persisted, and it carries no per-user identity - just which bot, which category,
// and when.

// Isomorphic (client + server) home for this constant - categorize-question.ts is $lib/server-only
// and can't be imported from client code, but the client also needs this label (e.g. to offer
// "Ukategorisert" as a trend-chart option in ChatConfigStats.svelte).
export const FALLBACK_CATEGORY = "Ukategorisert"

export type QuestionCategoryStat = {
	agentId: string
	category: string
	date: Date
	// Only set when category === "Ukategorisert" - a short, generalized AI-guessed topic (never the
	// question verbatim, never names/dates/specific details - see categorize-question.ts) so a bot
	// author can spot unanticipated question types without any real question content being stored.
	suggestedTopic?: string
}

export type CategoryCount = {
	category: string
	count: number
}

// One category's count for a single day (YYYY-MM-DD, UTC) - used to plot how one category trends
// over a period, as opposed to CategoryCount's one-total-per-category-for-the-whole-period.
export type CategoryDateCount = {
	date: string
	count: number
}

// A single "Ukategorisert" sample - deliberately NOT aggregated/counted like CategoryCount, since
// suggestedTopic is free text a weak model phrases inconsistently question to question. Shown as a
// raw sampled list instead, so a bot author can spot unanticipated topics without treating this as
// reliable countable data.
export type UncategorizedSample = {
	date: Date
	suggestedTopic: string
}
