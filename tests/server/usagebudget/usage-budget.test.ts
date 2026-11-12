import type { Response } from "openai/resources/responses/responses"
import { describe, expect, it } from "vitest"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { splitAppRoles } from "$lib/server/auth/principal-roles"
import { getRateLimiter } from "$lib/server/db/get-db"
import { usageFromMistral } from "$lib/server/mistral/mistral-mapping"
import type { ModelConfig } from "$lib/server/models/types"
import { usageFromOpenAIResponse } from "$lib/server/openai/openai-mapping"
import { createSse } from "$lib/streaming"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { estimateInputUsage, modelPriceFor, requestTexts, UNKNOWN_MODEL_PRICE, usageBudgetFor, usageCostUsd } from "$lib/usagebudget/server/cost"
import { acquireCallSlot, assertWithinUsageBudget, isAnonymousEmbedOverBudget, meterUsageStream, recordUsage, reserveUsage } from "$lib/usagebudget/server/usage-budget"
import { FALLBACK_USAGE_LIMITS, getUsageLimits, resolveModelPrices, resolveUsageLimits } from "$lib/usagebudget/server/usage-limits"
import type { UsageLimits } from "$lib/usagebudget/types"

// The limits under test are the MockUsageLimitsStore's (MOCK_DB=true), seeded like a real environment
const limits = () => getUsageLimits()
const WEB_SEARCH = 0.03

const BUDGETS: UsageLimits["budgets"] = {
	employee: { perHourUsd: 1, perDayUsd: 4 },
	edu_employee: { perHourUsd: 2, perDayUsd: 3 },
	student: { perHourUsd: 0.3, perDayUsd: 1 }
}

const DAY_MS = 24 * 60 * 60_000

let userCounter = 0
const principal = (...roles: string[]): AuthenticatedPrincipal => ({
	userId: `budget-user-${++userCounter}`,
	name: "U",
	preferredUserName: "u",
	...splitAppRoles(roles, APP_CONFIG.APP_ROLES),
	groups: []
})

const modelConfig = {
	MODELS: {
		priced: { vendor: "OPENAI", providerModel: "priced-model", files: "none", capabilities: [] },
		unpriced: { vendor: "OPENAI", providerModel: "unpriced-model", files: "none", capabilities: [] }
	},
	PROFILES: [],
	DEFAULTS: { chat: "", assistant: "", canvas: "", utility: "" },
	LEGACY: {}
} satisfies ModelConfig

const spentToday = async (user: AuthenticatedPrincipal) => (await getRateLimiter().getCount(`usage-budget:user-day:${user.userId}`, DAY_MS)).count

// Reads a stream to the end, like a client would
const drain = async (stream: ReadableStream<Uint8Array>) => {
	const reader = stream.getReader()
	while (!(await reader.read()).done) {}
}

// recordUsage is fire-and-forget inside meterUsageStream - let it land before asserting
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

const streamOf = (...chunks: Uint8Array[]) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk)
			controller.close()
		}
	})

const done = (inputTokens: number, outputTokens: number) => createSse({ event: "response.done", data: { usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } } })

describe("usage cost", () => {
	it("prices input and output tokens separately, per million", () => {
		expect(usageCostUsd({ inputPerMillion: 10, outputPerMillion: 40 }, { inputTokens: 500_000, outputTokens: 250_000, totalTokens: 750_000 }, WEB_SEARCH)).toBe(15)
	})

	it("adds the per-call web search fee on top of the tokens", () => {
		const price = { inputPerMillion: 10, outputPerMillion: 40 }
		const tokens = { inputTokens: 500_000, outputTokens: 250_000, totalTokens: 750_000 }
		expect(usageCostUsd(price, { ...tokens, webSearchCalls: 4 }, WEB_SEARCH)).toBeCloseTo(15 + 4 * WEB_SEARCH)
		expect(usageCostUsd(price, { inputTokens: 0, outputTokens: 0, totalTokens: 0, webSearchCalls: 1 }, WEB_SEARCH)).toBeGreaterThan(0)
	})

	it("counts OpenAI web search calls from the response output", () => {
		const response = { usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }, output: [{ type: "web_search_call" }, { type: "web_search_call" }, { type: "message" }] } as unknown as Response
		expect(usageFromOpenAIResponse(response)).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15, webSearchCalls: 2 })
	})

	it("counts Mistral connector calls, and their tokens as input", () => {
		expect(usageFromMistral({ promptTokens: 10, completionTokens: 5, totalTokens: 15, connectorTokens: 100, connectors: { web_search: 3 } })).toEqual({
			inputTokens: 110,
			outputTokens: 5,
			totalTokens: 115,
			webSearchCalls: 3
		})
	})

	it("looks a model up by vendor + provider model, prices it by catalogue key, and never treats a missing price as free", () => {
		const prices = { priced: { inputPerMillion: 10, outputPerMillion: 40 } }
		expect(modelPriceFor(modelConfig, prices, "OPENAI", "priced-model")).toEqual({ inputPerMillion: 10, outputPerMillion: 40 })
		expect(modelPriceFor(modelConfig, prices, "OPENAI", "unpriced-model")).toBe(UNKNOWN_MODEL_PRICE)
		expect(modelPriceFor(modelConfig, prices, "MISTRAL", "priced-model")).toBe(UNKNOWN_MODEL_PRICE)
		expect(modelPriceFor(modelConfig, prices, "OPENAI", undefined)).toBe(UNKNOWN_MODEL_PRICE)
	})

	it("estimates ~4 characters per input token", () => {
		expect(estimateInputUsage(["abcd", "abcde"])).toEqual({ inputTokens: 3, outputTokens: 0, totalTokens: 3 })
	})
})

describe("usageBudgetFor", () => {
	it("gives the most generous budget across the user's brukertyper, per window", () => {
		expect(usageBudgetFor(principal(APP_CONFIG.APP_ROLES.STUDENT, APP_CONFIG.APP_ROLES.EMPLOYEE), BUDGETS)).toEqual(BUDGETS.employee)
		expect(usageBudgetFor(principal(APP_CONFIG.APP_ROLES.EMPLOYEE, APP_CONFIG.APP_ROLES.EDU_EMPLOYEE), BUDGETS)).toEqual({ perHourUsd: 2, perDayUsd: 4 })
	})

	it("falls back to the student budget for a user with no brukertype", () => {
		expect(usageBudgetFor(principal(), BUDGETS)).toEqual(BUDGETS.student)
	})

	it("gives the admin role no extra budget - only the brukertype counts", () => {
		expect(usageBudgetFor(principal(APP_CONFIG.APP_ROLES.ADMIN), BUDGETS)).toEqual(BUDGETS.student)
		expect(usageBudgetFor(principal(APP_CONFIG.APP_ROLES.ADMIN, APP_CONFIG.APP_ROLES.EMPLOYEE), BUDGETS)).toEqual(BUDGETS.employee)
	})
})

describe("resolveUsageLimits", () => {
	const valid: UsageLimits = {
		budgets: BUDGETS,
		anonymousEmbed: { perHourUsd: 1, perDayUsd: 5 },
		maxConcurrentCalls: 3,
		webSearchCallPriceUsd: 0.03,
		maxFileContentCharacters: 150_000,
		embedRateLimits: { perIpPerMinute: 20, perIpPerDay: 200, perBotPerDay: null }
	}
	const raw = (values: Record<string, unknown>) => ({ values, updatedAt: null, updatedBy: null })

	it("uses the strict floor for everything when nothing is saved yet", () => {
		const resolved = resolveUsageLimits(null)
		expect(resolved.limits).toEqual(FALLBACK_USAGE_LIMITS)
		expect(resolved.fallbackFields).toEqual(["budgets", "anonymousEmbed", "maxConcurrentCalls", "webSearchCallPriceUsd", "maxFileContentCharacters", "embedRateLimits"])
	})

	it("keeps the floor strict - nobody above the student budget", () => {
		for (const budget of [...Object.values(FALLBACK_USAGE_LIMITS.budgets), FALLBACK_USAGE_LIMITS.anonymousEmbed]) {
			expect(budget.perHourUsd).toBeLessThanOrEqual(0.3)
			expect(budget.perDayUsd).toBeLessThanOrEqual(1)
		}
	})

	it("uses a valid document as-is", () => {
		expect(resolveUsageLimits(raw(valid))).toMatchObject({ limits: valid, fallbackFields: [] })
	})

	it("falls back field by field, keeping the valid rest", () => {
		const resolved = resolveUsageLimits(
			raw({
				...valid,
				budgets: { ...BUDGETS, student: { perHourUsd: -1, perDayUsd: 1 } },
				maxConcurrentCalls: "3",
				webSearchCallPriceUsd: undefined
			})
		)
		expect(resolved.fallbackFields).toEqual(["budgets", "maxConcurrentCalls", "webSearchCallPriceUsd"])
		expect(resolved.limits).toEqual({
			...valid,
			budgets: FALLBACK_USAGE_LIMITS.budgets,
			maxConcurrentCalls: FALLBACK_USAGE_LIMITS.maxConcurrentCalls,
			webSearchCallPriceUsd: FALLBACK_USAGE_LIMITS.webSearchCallPriceUsd
		})
	})

	it("rejects a typo-sized value instead of lifting the cap", () => {
		expect(resolveUsageLimits(raw({ ...valid, budgets: { ...BUDGETS, student: { perHourUsd: 3000, perDayUsd: 1 } } })).fallbackFields).toEqual(["budgets"])
	})

	it("never changes the floor itself", () => {
		const resolved = resolveUsageLimits(null)
		resolved.limits.budgets.student.perHourUsd = 99
		expect(FALLBACK_USAGE_LIMITS.budgets.student.perHourUsd).toBe(0.3)
	})
})

describe("resolveModelPrices", () => {
	it("leaves broken price documents out, so those models are priced as unknown", () => {
		const doc = (model: string, inputPerMillion: unknown, outputPerMillion: unknown) => ({ model, inputPerMillion, outputPerMillion, updatedAt: null, updatedBy: null })
		const { entries, invalid } = resolveModelPrices([doc("ok", 1, 2), doc("free", 0, 0), doc("text", "1", 2), doc("negative", -1, 2), doc("missing", 1, undefined)])
		expect(entries.map((entry) => entry.model)).toEqual(["ok", "free"])
		expect(invalid).toEqual(["text", "negative", "missing"])
	})
})

describe("assertWithinUsageBudget", () => {
	it("lets a user through until the daily budget is spent, then answers 429", async () => {
		const user = principal(APP_CONFIG.APP_ROLES.STUDENT)
		await expect(assertWithinUsageBudget(user)).resolves.toBeUndefined()

		await getRateLimiter().add(`usage-budget:user-day:${user.userId}`, (await limits()).budgets.student.perDayUsd, DAY_MS)
		await expect(assertWithinUsageBudget(user)).rejects.toMatchObject({ status: 429, message: expect.stringContaining("i dag") })
	})
})

describe("meterUsageStream", () => {
	it("passes the stream through and records the usage from response.done", async () => {
		const user = principal()
		const body = [createSse({ event: "response.started", data: { responseId: "r" } }), done(1_000_000, 0)]
		const reader = meterUsageStream(streamOf(...body), await reserveUsage(user, { vendorId: "MISTRAL", model: "not-in-catalogue" }, estimateInputUsage([]))).getReader()

		const received: Uint8Array[] = []
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) received.push(chunk.value)
		await settle()

		expect(received).toEqual(body)
		expect(await spentToday(user)).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("finds response.done even when it's split across chunks", async () => {
		const user = principal()
		const event = done(0, 1_000_000)
		await drain(meterUsageStream(streamOf(event.slice(0, 10), event.slice(10)), await reserveUsage(user, { vendorId: "MISTRAL" }, estimateInputUsage([]))))
		await settle()

		expect(await spentToday(user)).toBe(UNKNOWN_MODEL_PRICE.outputPerMillion)
	})

	it("records the fallback estimate when the client aborts before response.done", async () => {
		const user = principal()
		const source = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(createSse({ event: "response.started", data: { responseId: "r" } }))
			}
		})
		const reader = meterUsageStream(source, await reserveUsage(user, { vendorId: "MISTRAL" }, { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 })).getReader()
		await reader.read()
		await reader.cancel()
		await settle()

		expect(await spentToday(user)).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("adds to what the user has already spent in the window", async () => {
		// Employee, and small enough that the first call doesn't already use up the budget the reservation checks
		const user = principal(APP_CONFIG.APP_ROLES.EMPLOYEE)
		await recordUsage(user, { vendorId: "MISTRAL" }, { inputTokens: 100_000, outputTokens: 0, totalTokens: 100_000 })
		await drain(meterUsageStream(streamOf(done(100_000, 0)), await reserveUsage(user, { vendorId: "MISTRAL" }, estimateInputUsage([]))))
		await settle()

		expect(await spentToday(user)).toBeCloseTo(0.2 * UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("prices a catalogue model by its DB price", async () => {
		const user = principal(APP_CONFIG.APP_ROLES.EMPLOYEE)
		// gpt-6-luna is 0.1 USD per 1M input in the mock store
		await recordUsage(user, { vendorId: "OPENAI", model: "gpt-6-luna" }, { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 })
		expect(await spentToday(user)).toBeCloseTo(0.1)
	})
})

describe("reserveUsage", () => {
	const mistral = { vendorId: "MISTRAL" } as const
	// Priced as UNKNOWN_MODEL_PRICE, so this many input tokens cost `usd`
	const inputWorth = (usd: number) => {
		const inputTokens = Math.round((usd / UNKNOWN_MODEL_PRICE.inputPerMillion) * 1_000_000)
		return { inputTokens, outputTokens: 0, totalTokens: inputTokens }
	}

	it("counts the estimated input straight away, then settles to the real usage", async () => {
		const user = principal()
		const reservation = await reserveUsage(user, mistral, inputWorth(0.2))
		expect(await spentToday(user)).toBeCloseTo(0.2)

		reservation.settle(inputWorth(0.05))
		await settle()
		expect(await spentToday(user)).toBeCloseTo(0.05)
	})

	it("keeps the estimate when the call ends without reporting usage, and gives it all back on cancel", async () => {
		const user = principal()
		;(await reserveUsage(user, mistral, inputWorth(0.1))).settle(null)
		const cancelled = await reserveUsage(user, mistral, inputWorth(0.2))
		cancelled.cancel()
		cancelled.settle(inputWorth(0.2))
		await settle()
		expect(await spentToday(user)).toBeCloseTo(0.1)
	})

	it("refuses a call when other calls in flight already reserved the rest of the budget", async () => {
		const user = principal(APP_CONFIG.APP_ROLES.STUDENT)
		const studentPerDay = (await limits()).budgets.student.perDayUsd
		await getRateLimiter().add(`usage-budget:user-day:${user.userId}`, studentPerDay - 0.1, DAY_MS)

		// Its own reservation never counts against it - only what was there before
		await reserveUsage(user, mistral, inputWorth(0.2))
		await expect(reserveUsage(user, mistral, inputWorth(0.01))).rejects.toMatchObject({ status: 429 })
		await settle()
		expect(await spentToday(user)).toBeCloseTo(studentPerDay + 0.1)
	})
})

describe("acquireCallSlot", () => {
	it("refuses a fourth call while three are in flight - the parallel-request overshoot of a check-then-record budget", async () => {
		expect((await limits()).maxConcurrentCalls).toBe(3)
		const user = principal()
		const releases = await Promise.all([acquireCallSlot(user), acquireCallSlot(user), acquireCallSlot(user)])
		await expect(acquireCallSlot(user)).rejects.toMatchObject({ status: 429 })

		releases[0]?.()
		await settle()
		await expect(acquireCallSlot(user)).resolves.toBeTypeOf("function")
	})

	it("doesn't count a refused attempt as in flight", async () => {
		const user = principal()
		const releases = await Promise.all([acquireCallSlot(user), acquireCallSlot(user), acquireCallSlot(user)])
		for (let i = 0; i < 5; i++) await expect(acquireCallSlot(user)).rejects.toMatchObject({ status: 429 })
		await settle()

		releases[0]?.()
		await settle()
		await expect(acquireCallSlot(user)).resolves.toBeTypeOf("function")
	})

	it("only gives a slot back once, however often release is called", async () => {
		const user = principal()
		const release = await acquireCallSlot(user)
		await Promise.all([acquireCallSlot(user), acquireCallSlot(user)])
		release()
		release()
		release()
		await settle()

		await acquireCallSlot(user)
		await expect(acquireCallSlot(user)).rejects.toMatchObject({ status: 429 })
	})

	it("is released by meterUsageStream when the stream ends or is aborted", async () => {
		const user = principal()
		const ended = await acquireCallSlot(user)
		await drain(meterUsageStream(streamOf(done(1, 1)), await reserveUsage(user, { vendorId: "MISTRAL" }, estimateInputUsage([])), ended))

		const aborted = await acquireCallSlot(user)
		const reader = meterUsageStream(new ReadableStream<Uint8Array>(), await reserveUsage(user, { vendorId: "MISTRAL" }, estimateInputUsage([])), aborted).getReader()
		await reader.cancel()
		await settle()

		await Promise.all([acquireCallSlot(user), acquireCallSlot(user), acquireCallSlot(user)])
		await expect(acquireCallSlot(user)).rejects.toMatchObject({ status: 429 })
	})
})

describe("anonymous embed budget", () => {
	let botCounter = 0
	const bot = () => `budget-bot-${++botCounter}`

	it("is counted per bot, separately from any user", async () => {
		const botId = bot()
		expect(await isAnonymousEmbedOverBudget(botId)).toBe(false)

		await recordUsage({ anonymousEmbedBotId: botId }, { vendorId: "MISTRAL" }, { inputTokens: 0, outputTokens: 1_000_000, totalTokens: 1_000_000 })
		expect(await getRateLimiter().getCount(`usage-budget:anon-bot-day:${botId}`, DAY_MS)).toMatchObject({ count: UNKNOWN_MODEL_PRICE.outputPerMillion })
		expect(await isAnonymousEmbedOverBudget(bot())).toBe(false)
	})

	it("is over budget once the bot's daily anonymousEmbed budget is spent", async () => {
		const botId = bot()
		await getRateLimiter().add(`usage-budget:anon-bot-day:${botId}`, (await limits()).anonymousEmbed.perDayUsd, DAY_MS)
		expect(await isAnonymousEmbedOverBudget(botId)).toBe(true)
	})

	it("gets metered from the stream like a user's", async () => {
		const botId = bot()
		await drain(meterUsageStream(streamOf(done(1_000_000, 0)), await reserveUsage({ anonymousEmbedBotId: botId }, { vendorId: "MISTRAL" }, estimateInputUsage([]))))
		await settle()
		expect((await getRateLimiter().getCount(`usage-budget:anon-bot-hour:${botId}`, 60 * 60_000)).count).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})
})

describe("requestTexts", () => {
	it("collects the instructions and every text part, leaving attachments out", () => {
		expect(
			requestTexts("sys", [
				{
					type: "message.input",
					role: "user",
					content: [
						{ type: "input_text", text: "hei" },
						{ type: "input_file", fileName: "a.pdf", fileUrl: "data:application/pdf;base64,AAAA" }
					]
				},
				{ id: "1", type: "message.output", role: "assistant", content: [{ type: "output_text", text: "svar" }] }
			])
		).toEqual(["sys", "hei", "svar"])
	})
})
