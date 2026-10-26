import { describe, expect, it } from "vitest"
import { APP_CONFIG } from "$lib/server/app-config/app-config"
import { getRateLimiter } from "$lib/server/db/get-db"
import type { ModelConfig } from "$lib/server/models/types"
import { createSse } from "$lib/streaming"
import type { AuthenticatedPrincipal } from "$lib/types/authentication"
import { DEFAULT_USAGE_BUDGETS, estimateInputUsage, modelPriceFor, parseUsageBudgets, requestTexts, UNKNOWN_MODEL_PRICE, usageBudgetFor, usageCostUsd } from "$lib/usagebudget/server/cost"
import { acquireCallSlot, assertWithinUsageBudget, isAnonymousEmbedOverBudget, meterUsageStream, recordUsage, USAGE_BUDGETS } from "$lib/usagebudget/server/usage-budget"

const DAY_MS = 24 * 60 * 60_000

let userCounter = 0
const principal = (...roles: string[]): AuthenticatedPrincipal => ({ userId: `budget-user-${++userCounter}`, name: "U", preferredUserName: "u", roles, groups: [] })

const modelConfig = {
	MODELS: {
		priced: { vendor: "OPENAI", providerModel: "priced-model", files: "none", capabilities: [], price: { inputPerMillion: 10, outputPerMillion: 40 } },
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
		expect(usageCostUsd({ inputPerMillion: 10, outputPerMillion: 40 }, { inputTokens: 500_000, outputTokens: 250_000, totalTokens: 750_000 })).toBe(15)
	})

	it("looks a model up by vendor + provider model, and never treats a missing price as free", () => {
		expect(modelPriceFor(modelConfig, "OPENAI", "priced-model")).toEqual({ inputPerMillion: 10, outputPerMillion: 40 })
		expect(modelPriceFor(modelConfig, "OPENAI", "unpriced-model")).toBe(UNKNOWN_MODEL_PRICE)
		expect(modelPriceFor(modelConfig, "MISTRAL", "priced-model")).toBe(UNKNOWN_MODEL_PRICE)
		expect(modelPriceFor(modelConfig, "OPENAI", undefined)).toBe(UNKNOWN_MODEL_PRICE)
	})

	it("estimates ~4 characters per input token", () => {
		expect(estimateInputUsage(["abcd", "abcde"])).toEqual({ inputTokens: 3, outputTokens: 0, totalTokens: 3 })
	})
})

describe("usageBudgetFor", () => {
	it("gives the most generous budget across the user's roles", () => {
		expect(usageBudgetFor(principal(APP_CONFIG.APP_ROLES.STUDENT, APP_CONFIG.APP_ROLES.EMPLOYEE), APP_CONFIG.APP_ROLES, DEFAULT_USAGE_BUDGETS)).toEqual(DEFAULT_USAGE_BUDGETS.EMPLOYEE)
	})

	it("falls back to the student budget for a user with no budgeted role", () => {
		expect(usageBudgetFor(principal(), APP_CONFIG.APP_ROLES, DEFAULT_USAGE_BUDGETS)).toEqual(DEFAULT_USAGE_BUDGETS.STUDENT)
	})
})

describe("parseUsageBudgets", () => {
	it("uses the defaults when USAGE_BUDGET is unset or blank", () => {
		expect(parseUsageBudgets(undefined)).toEqual({ budgets: DEFAULT_USAGE_BUDGETS, warnings: [] })
		expect(parseUsageBudgets("  ")).toEqual({ budgets: DEFAULT_USAGE_BUDGETS, warnings: [] })
	})

	it("overrides only the roles and fields that are set", () => {
		const { budgets, warnings } = parseUsageBudgets('{"STUDENT":{"hour":0.01},"ADMIN":{"hour":2,"day":8}}')
		expect(warnings).toEqual([])
		expect(budgets).toEqual({
			...DEFAULT_USAGE_BUDGETS,
			STUDENT: { perHourUsd: 0.01, perDayUsd: DEFAULT_USAGE_BUDGETS.STUDENT.perDayUsd },
			ADMIN: { perHourUsd: 2, perDayUsd: 8 }
		})
	})

	it("never changes the defaults themselves", () => {
		parseUsageBudgets('{"STUDENT":{"hour":99}}')
		expect(DEFAULT_USAGE_BUDGETS.STUDENT.perHourUsd).toBe(0.3)
	})

	it("falls back to the defaults on invalid JSON or a non-object", () => {
		for (const raw of ["{STUDENT:", "[1,2]", "5"]) {
			const { budgets, warnings } = parseUsageBudgets(raw)
			expect(budgets).toEqual(DEFAULT_USAGE_BUDGETS)
			expect(warnings).toHaveLength(1)
		}
	})

	it("skips unknown roles/fields and non-positive or non-numeric values, keeping the valid rest", () => {
		const { budgets, warnings } = parseUsageBudgets('{"TEACHER":{"hour":1},"STUDENT":{"hour":0,"day":"5","week":3},"EMPLOYEE":7,"ADMIN":{"day":-1,"hour":3}}')
		expect(budgets).toEqual({ ...DEFAULT_USAGE_BUDGETS, ADMIN: { perHourUsd: 3, perDayUsd: DEFAULT_USAGE_BUDGETS.ADMIN.perDayUsd } })
		expect(warnings).toHaveLength(6)
	})

	it("doesn't treat inherited object keys as roles", () => {
		const { budgets, warnings } = parseUsageBudgets('{"constructor":{"hour":1},"__proto__":{"hour":1}}')
		expect(budgets).toEqual(DEFAULT_USAGE_BUDGETS)
		expect(warnings).toHaveLength(2)
	})
})

describe("assertWithinUsageBudget", () => {
	it("lets a user through until the daily budget is spent, then answers 429", async () => {
		const user = principal(APP_CONFIG.APP_ROLES.STUDENT)
		await expect(assertWithinUsageBudget(user)).resolves.toBeUndefined()

		await getRateLimiter().add(`usage-budget:user-day:${user.userId}`, USAGE_BUDGETS.STUDENT.perDayUsd, DAY_MS)
		await expect(assertWithinUsageBudget(user)).rejects.toMatchObject({ status: 429, message: expect.stringContaining("i dag") })
	})
})

describe("meterUsageStream", () => {
	it("passes the stream through and records the usage from response.done", async () => {
		const user = principal()
		const body = [createSse({ event: "response.started", data: { responseId: "r" } }), done(1_000_000, 0)]
		const reader = meterUsageStream(streamOf(...body), user, { vendorId: "MISTRAL", model: "not-in-catalogue" }, estimateInputUsage([])).getReader()

		const received: Uint8Array[] = []
		for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) received.push(chunk.value)
		await settle()

		expect(received).toEqual(body)
		expect(await spentToday(user)).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("finds response.done even when it's split across chunks", async () => {
		const user = principal()
		const event = done(0, 1_000_000)
		await drain(meterUsageStream(streamOf(event.slice(0, 10), event.slice(10)), user, { vendorId: "MISTRAL" }, estimateInputUsage([])))
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
		const reader = meterUsageStream(source, user, { vendorId: "MISTRAL" }, { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 }).getReader()
		await reader.read()
		await reader.cancel()
		await settle()

		expect(await spentToday(user)).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("adds to what the user has already spent in the window", async () => {
		const user = principal()
		await recordUsage(user, { vendorId: "MISTRAL" }, { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 })
		await drain(meterUsageStream(streamOf(done(1_000_000, 0)), user, { vendorId: "MISTRAL" }, estimateInputUsage([])))
		await settle()

		expect(await spentToday(user)).toBe(2 * UNKNOWN_MODEL_PRICE.inputPerMillion)
	})
})

describe("acquireCallSlot", () => {
	it("refuses a fourth call while three are in flight - the parallel-request overshoot of a check-then-record budget", async () => {
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
		await drain(meterUsageStream(streamOf(done(1, 1)), user, { vendorId: "MISTRAL" }, estimateInputUsage([]), ended))

		const aborted = await acquireCallSlot(user)
		const reader = meterUsageStream(new ReadableStream<Uint8Array>(), user, { vendorId: "MISTRAL" }, estimateInputUsage([]), aborted).getReader()
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

	it("is over budget once the bot's daily ANONYMOUS_EMBED budget is spent", async () => {
		const botId = bot()
		await getRateLimiter().add(`usage-budget:anon-bot-day:${botId}`, USAGE_BUDGETS.ANONYMOUS_EMBED.perDayUsd, DAY_MS)
		expect(await isAnonymousEmbedOverBudget(botId)).toBe(true)
	})

	it("gets metered from the stream like a user's", async () => {
		const botId = bot()
		await drain(meterUsageStream(streamOf(done(1_000_000, 0)), { anonymousEmbedBotId: botId }, { vendorId: "MISTRAL" }, estimateInputUsage([])))
		await settle()
		expect((await getRateLimiter().getCount(`usage-budget:anon-bot-hour:${botId}`, 60 * 60_000)).count).toBe(UNKNOWN_MODEL_PRICE.inputPerMillion)
	})

	it("is never mistaken for a role when picking a user's budget", () => {
		expect(usageBudgetFor(principal(), APP_CONFIG.APP_ROLES, { ...DEFAULT_USAGE_BUDGETS, ANONYMOUS_EMBED: { perHourUsd: 999, perDayUsd: 999 } })).toEqual(DEFAULT_USAGE_BUDGETS.STUDENT)
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
