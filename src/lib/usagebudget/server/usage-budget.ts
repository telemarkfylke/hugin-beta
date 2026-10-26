import { logger } from "@vestfoldfylke/loglady"
import { env } from "$env/dynamic/private"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getRateLimiter } from "$lib/server/db/get-db"
import { HTTPError } from "$lib/server/middleware/http-error"
import { MODEL_CONFIG } from "$lib/server/models/models.config"
import { parseSse } from "$lib/streaming"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import type { ChatResponseUsage, VendorId } from "$lib/types/chat"
import { modelPriceFor, parseUsageBudgets, usageBudgetFor, usageCostUsd } from "./cost"

// Token-cost budget, counted in USD on the shared rate-limit counters (see IRateLimiter) - per user,
// or per anonymously embedded assistant. Check-then-record, not atomic: the cost is only known once
// the vendor has answered, so a user can overshoot by whatever calls they had in flight when they
// crossed the line - bounded by acquireCallSlot below. Deliberately independent of incognito/store,
// like the stats.

type MeteredModel = { vendorId: VendorId; model?: string | undefined }

// Who a budget is counted for: a logged-in user, or - on the anonymous embed, where there's no user -
// the embedded assistant itself, shared by all its visitors.
export type BudgetSubject = AuthenticatedPrincipal | { anonymousEmbedBotId: string }

const isAnonymousEmbed = (subject: BudgetSubject): subject is { anonymousEmbedBotId: string } => "anonymousEmbedBotId" in subject

const parsedBudgets = parseUsageBudgets(env.USAGE_BUDGET)
for (const warning of parsedBudgets.warnings) {
	logger.warn(warning)
}
// The effective per-role budgets: DEFAULT_USAGE_BUDGETS with the USAGE_BUDGET env overrides applied
export const USAGE_BUDGETS = parsedBudgets.budgets

const HOUR_MS = 60 * 60_000
const DAY_MS = 24 * HOUR_MS

const budgetKeys = (subject: BudgetSubject) =>
	isAnonymousEmbed(subject)
		? { hour: `usage-budget:anon-bot-hour:${subject.anonymousEmbedBotId}`, day: `usage-budget:anon-bot-day:${subject.anonymousEmbedBotId}` }
		: { hour: `usage-budget:user-hour:${subject.userId}`, day: `usage-budget:user-day:${subject.userId}` }

const subjectLabel = (subject: BudgetSubject) => (isAnonymousEmbed(subject) ? `anonymous embed of ${subject.anonymousEmbedBotId}` : subject.userId)

const formatRetry = (ms: number): string => {
	const minutes = Math.ceil(ms / 60_000)
	if (minutes < 60) {
		return `${minutes} ${minutes === 1 ? "minutt" : "minutter"}`
	}
	const hours = Math.ceil(minutes / 60)
	return `${hours} ${hours === 1 ? "time" : "timer"}`
}

// The window the subject has used up (day checked first), or null while within budget
const findExceededWindow = async (subject: BudgetSubject): Promise<{ window: "day" | "hour"; retryAfterMs: number } | null> => {
	const budget = isAnonymousEmbed(subject) ? USAGE_BUDGETS.ANONYMOUS_EMBED : usageBudgetFor(subject, APP_CONFIG.APP_ROLES, USAGE_BUDGETS)
	const keys = budgetKeys(subject)
	const rateLimiter = getRateLimiter()
	const [hour, day] = await Promise.all([rateLimiter.getCount(keys.hour, HOUR_MS), rateLimiter.getCount(keys.day, DAY_MS)])

	if (day.count >= budget.perDayUsd) {
		logger.warn("Usage budget: {subject} is over the daily budget ({spent} of {budget} USD)", subjectLabel(subject), day.count.toFixed(2), budget.perDayUsd)
		return { window: "day", retryAfterMs: day.retryAfterMs }
	}
	if (hour.count >= budget.perHourUsd) {
		logger.warn("Usage budget: {subject} is over the hourly budget ({spent} of {budget} USD)", subjectLabel(subject), hour.count.toFixed(2), budget.perHourUsd)
		return { window: "hour", retryAfterMs: hour.retryAfterMs }
	}
	return null
}

// Call before any vendor work - throws a 429 with a user-facing (Norwegian) message, which the chat
// and canvas clients already show as-is.
export const assertWithinUsageBudget = async (user: AuthenticatedPrincipal): Promise<void> => {
	const exceeded = await findExceededWindow(user)
	if (exceeded) {
		throw new HTTPError(429, `Du har nådd grensen for KI-bruk ${exceeded.window === "day" ? "i dag" : "denne timen"}. Prøv igjen om ${formatRetry(exceeded.retryAfterMs)}.`)
	}
}

// The anonymous embed's counterpart - that route answers with its own generic rate-limit message, so
// this just says whether the assistant's shared budget is used up.
export const isAnonymousEmbedOverBudget = async (botId: string): Promise<boolean> => (await findExceededWindow({ anonymousEmbedBotId: botId })) !== null

// The budget above is check-now-record-later, so without this a script firing hundreds of requests
// at once would get all of them past assertWithinUsageBudget before the first one's cost landed.
// Capping the calls in flight per user bounds that overshoot to MAX_CONCURRENT_CALLS x one call,
// and one call is itself bounded (input size limits, MAX_OUTPUT_TOKENS).
const MAX_CONCURRENT_CALLS = 3
// A slot whose release never runs (process crashed mid-call) frees itself when its window ends. A
// release landing in the next window decrements that one instead, which can briefly allow a few
// extra calls right after a rollover - bounded, and far simpler than per-slot bookkeeping.
const CONCURRENCY_WINDOW_MS = 10 * 60_000
const concurrencyKey = (userId: string) => `usage-budget:user-inflight:${userId}`

// Take a slot right before the vendor call; call the returned release once the call is over (stream
// ended/aborted, response returned, or an error). Safe to call release more than once.
export const acquireCallSlot = async (user: AuthenticatedPrincipal): Promise<() => void> => {
	const rateLimiter = getRateLimiter()
	const key = concurrencyKey(user.userId)
	const slot = await rateLimiter.checkAndIncrement(key, MAX_CONCURRENT_CALLS, CONCURRENCY_WINDOW_MS)
	let released = false
	const release = () => {
		if (released) return
		released = true
		rateLimiter.add(key, -1, CONCURRENCY_WINDOW_MS).catch((error) => {
			logger.errorException(error, "Failed to release call slot for {userId}", user.userId)
		})
	}
	if (!slot.allowed) {
		// checkAndIncrement counted this attempt too - give it back
		release()
		logger.warn("Usage budget: {userId} already has {max} calls in flight", user.userId, MAX_CONCURRENT_CALLS)
		throw new HTTPError(429, "Du har allerede flere svar på vei. Vent til de er ferdige, og prøv igjen.")
	}
	return release
}

export const recordUsage = async (subject: BudgetSubject, model: MeteredModel, usage: ChatResponseUsage): Promise<void> => {
	const cost = usageCostUsd(modelPriceFor(MODEL_CONFIG, model.vendorId, model.model), usage)
	if (cost <= 0) {
		return
	}
	const keys = budgetKeys(subject)
	const rateLimiter = getRateLimiter()
	await Promise.all([rateLimiter.add(keys.hour, cost, HOUR_MS), rateLimiter.add(keys.day, cost, DAY_MS)])
}

// Passes the SSE stream through untouched and records the usage from its response.done event once
// it ends - or `fallbackUsage` if it never reports any (client aborted, vendor error). `onEnd` runs
// at that same moment, e.g. to release the call slot from acquireCallSlot.
export const meterUsageStream = (stream: ReadableStream<Uint8Array>, subject: BudgetSubject, model: MeteredModel, fallbackUsage: ChatResponseUsage, onEnd?: () => void): ReadableStream<Uint8Array> => {
	const reader = stream.getReader()
	const decoder = new TextDecoder("utf-8")
	let buffer = ""
	let usage: ChatResponseUsage | null = null
	let recorded = false

	const record = () => {
		if (recorded) return
		recorded = true
		onEnd?.()
		recordUsage(subject, model, usage ?? fallbackUsage).catch((error) => {
			logger.errorException(error, "Failed to record usage for {subject}", subjectLabel(subject))
		})
	}

	// Chunks needn't line up with SSE events - only parse up to the last complete one
	const scan = (text: string) => {
		buffer += text
		const end = buffer.lastIndexOf("\n\n")
		if (end === -1) return
		const complete = buffer.slice(0, end + 2)
		buffer = buffer.slice(end + 2)
		try {
			for (const event of parseSse(complete)) {
				if (event.event === "response.done") {
					usage = event.data.usage
				}
			}
		} catch (error) {
			logger.warn(`Usage budget: could not parse SSE chunk for metering: ${error instanceof Error ? error.message : error}`)
		}
	}

	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await reader.read()
				if (done) {
					record()
					controller.close()
					return
				}
				scan(decoder.decode(value, { stream: true }))
				controller.enqueue(value)
			} catch (error) {
				record()
				controller.error(error)
			}
		},
		cancel(reason) {
			record()
			return reader.cancel(reason)
		}
	})
}
