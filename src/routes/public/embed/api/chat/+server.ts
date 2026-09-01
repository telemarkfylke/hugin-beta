import { json, type RequestHandler } from "@sveltejs/kit"
import { logger } from "@vestfoldfylke/loglady"
import z from "zod"
import { env } from "$env/dynamic/private"
import { ANONYMOUS_PRINCIPAL } from "$lib/anonymous-principal"
import { getVendor } from "$lib/server/ai-vendors"
import { classifyQuestion, recordQuestionCategoryStat } from "$lib/server/categorize-question"
import { getChatConfigStore, getRateLimiter, getStatsStore } from "$lib/server/db/get-db"
import { appendRagContextToInstructions } from "$lib/server/ragservice/format-rag-context"
import { formatHistoryForRewrite } from "$lib/server/ragservice/rag-query-rewrite"
import { searchRagStores } from "$lib/server/ragservice/rag-search"
import { createSse, responseStream } from "$lib/streaming"
import type { ChatConfig, ChatResponseObject } from "$lib/types/chat"
import type { ChatInputItem, ChatInputMessage } from "$lib/types/chat-item"
import type { InputText } from "$lib/types/chat-item-content"

const chatConfigStore = getChatConfigStore()
const rateLimiter = getRateLimiter()

// Anonymous, unauthenticated route - rate limiting is the only thing standing between this and
// unbounded cost/abuse (anyone with a config._id, visible in the embed snippet on a public page,
// can call it).
//
// Two per-IP limits are always active:
//  - per minute: generous, well above normal human typing pace - stops a single scripted caller
//    bursting, not someone asking several real questions in a row.
//  - per day: bounds how much of any *shared* budget (see below) a single IP could consume on its
//    own by just staying under the per-minute cap indefinitely. Without this, one IP could sustain
//    that indefinitely and single-handedly exhaust a modest shared daily cap within well under an
//    hour (20/min * 25min = 500) - taking a bot down for every other visitor for the rest of the
//    day. This is what actually forces an attacker to spread across many IPs to do real damage.
//
// The per-bot (config._id) daily ceiling, by contrast, is OFF by default (no shared cap at all,
// deliberately - a flat shared limit is itself a single point every visitor competes for, which is
// exactly the "one visitor locks everyone else out" problem the per-IP-per-day limit above exists
// to prevent; defaulting it on just relocates that same risk to a slightly higher number). It only
// activates when a maintainer opts a specific bot into one (ChatConfig.rateLimitPerBotPerDay, or the
// env default below) - e.g. a bot with a genuinely fixed cost budget they want capped regardless of
// how legitimate the traffic is.
//
// All three are deployment-wide defaults (env), overridable per bot via
// ChatConfig.rateLimitPerIpPerMinute / rateLimitPerIpPerDay / rateLimitPerBotPerDay. The right
// numbers are a guess until there's real traffic to look at, hence env-overridable at all.
//
// getClientAddress() (used below) needs the deployment's reverse proxy correctly identified via the
// ADDRESS_HEADER/XFF_DEPTH env vars (see SvelteKit's adapter-node docs) - on Azure App Service
// specifically, set ADDRESS_HEADER=X-ARR-ClientIP (App Service's own always-real-client-IP header,
// simpler to trust than parsing X-Forwarded-For depth) and XFF_DEPTH=1. Misconfigured, every visitor
// resolves to the same address, which only makes the per-IP limits shared across all visitors (never
// silently too permissive). Verify by checking that the IP logged on a 429 below actually varies
// between real visitors once this is deployed.
const PER_IP_MINUTE_LIMIT = Number(env.EMBED_RATE_LIMIT_PER_IP_PER_MINUTE) || 20
const PER_IP_MINUTE_WINDOW_MS = 60_000
const PER_IP_DAILY_LIMIT = Number(env.EMBED_RATE_LIMIT_PER_IP_PER_DAY) || 200
const DAY_WINDOW_MS = 24 * 60 * 60_000
// Undefined (not a number, e.g. unset or "0") = no shared per-bot cap at all - see the comment
// above for why that's the deliberate default rather than some large fallback number.
const DEFAULT_PER_BOT_DAILY_LIMIT = Number(env.EMBED_RATE_LIMIT_PER_BOT_PER_DAY) || undefined
const RATE_LIMITED_MESSAGE = "For mange forespørsler akkurat nå. Prøv igjen om litt."

// Shown instead of a real answer when classifyQuestion judges the question out of scope for this
// bot (see the scope-guard block in POST below). Kept generic/neutral rather than referencing the
// bot by name - a canned refusal doesn't need to pretend to be a considered response.
const OUT_OF_SCOPE_MESSAGE = "Beklager, det spørsmålet er utenfor det jeg er satt opp til å hjelpe med her. Prøv gjerne å stille et spørsmål relatert til det jeg er ment å svare på."

// Synthesizes a minimal, valid ChatResponseObject for the canned refusal - same shape a real vendor
// response would have (see e.g. openai-mapping.ts), just built by hand since no vendor call is made.
const buildRefusalResponse = (config: ChatConfig, text: string): ChatResponseObject => ({
	id: crypto.randomUUID(),
	type: "chat_response",
	config,
	createdAt: new Date().toISOString(),
	outputs: [{ id: crypto.randomUUID(), type: "message.output", role: "assistant", content: [{ type: "output_text", text }] }],
	status: "completed",
	usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
})

// Streaming counterpart of buildRefusalResponse - the minimal SSE event sequence a real vendor
// stream produces (see e.g. litellm-stream.ts): started -> one full-text delta -> done.
const buildRefusalStream = (text: string): ReadableStream<Uint8Array> =>
	new ReadableStream({
		start(controller) {
			const itemId = crypto.randomUUID()
			controller.enqueue(createSse({ event: "response.started", data: { responseId: crypto.randomUUID() } }))
			controller.enqueue(createSse({ event: "response.output_text.delta", data: { itemId, content: text } }))
			controller.enqueue(createSse({ event: "response.done", data: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } } }))
			controller.close()
		}
	})

// ChatState/postChatMessage are reused unchanged from the authenticated flow (see EmbedChat.svelte),
// so the wire shape here is the same full ChatRequest they always send - config included. That's
// fine: config._id is used only as a lookup key below. Every value that actually reaches the vendor
// (instructions, tools, vendorId, ...) comes from the fresh DB-authoritative dbConfig, never from
// this parsed client object - the rest of the client's config is read nowhere and simply discarded.
const EmbedChatRequestSchema = z.object({
	config: z.object({ _id: z.string() }),
	inputs: z.array(z.any()).min(1),
	stream: z.boolean().optional()
})

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const body = await request.json().catch(() => null)
	const parsed = EmbedChatRequestSchema.safeParse(body)
	if (!parsed.success) {
		return json({ message: "Invalid request" }, { status: 400 })
	}

	// Fresh DB lookup - never trust a config object from the client here. Same 404 whether the
	// id doesn't exist or just isn't anonymously embeddable (see the page load's same reasoning).
	const dbConfig = await chatConfigStore.getChatConfig(parsed.data.config._id)
	if (!dbConfig?.allowAnonymousEmbed) {
		return json({ message: "Not found" }, { status: 404 })
	}

	// Rate limiting - see the module-level comment above for the three limits and the
	// ADDRESS_HEADER/XFF_DEPTH env setup this depends on. Checked before any other work (no
	// classification, no RAG search, no vendor call) so a rate-limited request costs almost nothing.
	//
	// getClientAddress() throws if ADDRESS_HEADER is configured but genuinely absent from this
	// particular request (adapter-node's own behavior - see its handler.js) - e.g. something
	// reaching the app outside Azure's normal front-end (an internal probe, local testing). Caught
	// and degraded to one shared bucket rather than 500ing the request: worst case every such
	// caller shares one IP-rate-limit counter, which is never less safe than today, just less
	// precise for that sliver of traffic - the per-bot daily limit (if the bot even has one) is
	// unaffected either way.
	let clientIp: string
	try {
		clientIp = getClientAddress()
	} catch (error) {
		logger.warn(`getClientAddress() failed (see ADDRESS_HEADER setup) - falling back to a shared rate-limit bucket: ${error instanceof Error ? error.message : error}`)
		clientIp = "unknown"
	}

	const ipMinuteLimit = await rateLimiter.checkAndIncrement(`embed-chat:ip-min:${clientIp}`, dbConfig.rateLimitPerIpPerMinute ?? PER_IP_MINUTE_LIMIT, PER_IP_MINUTE_WINDOW_MS)
	if (!ipMinuteLimit.allowed) {
		logger.warn(`Embed chat per-minute rate limit hit for IP ${clientIp} on bot ${dbConfig._id}`)
		return json({ message: RATE_LIMITED_MESSAGE }, { status: 429 })
	}

	const ipDailyLimit = await rateLimiter.checkAndIncrement(`embed-chat:ip-day:${clientIp}`, dbConfig.rateLimitPerIpPerDay ?? PER_IP_DAILY_LIMIT, DAY_WINDOW_MS)
	if (!ipDailyLimit.allowed) {
		logger.warn(`Embed chat per-day rate limit hit for IP ${clientIp} on bot ${dbConfig._id}`)
		return json({ message: RATE_LIMITED_MESSAGE }, { status: 429 })
	}

	// No shared per-bot cap unless a maintainer opted this bot into one - see the module-level
	// comment on why that's the default rather than some large fallback number.
	const botDailyLimit = dbConfig.rateLimitPerBotPerDay ?? DEFAULT_PER_BOT_DAILY_LIMIT
	if (botDailyLimit !== undefined) {
		const botLimit = await rateLimiter.checkAndIncrement(`embed-chat:bot-day:${dbConfig._id}`, botDailyLimit, DAY_WINDOW_MS)
		if (!botLimit.allowed) {
			logger.warn(`Embed chat daily rate limit hit for bot ${dbConfig._id}`)
			return json({ message: RATE_LIMITED_MESSAGE }, { status: 429 })
		}
	}

	const inputs = parsed.data.inputs as ChatInputItem[]
	const wantsStream = Boolean(parsed.data.stream)

	// --- From here down: the same RAG-search + vendor-dispatch logic as supahChat
	// (src/routes/api/chat/+server.ts) - deliberately duplicated rather than shared for now, to
	// avoid touching that well-exercised, authenticated code path in a PoC. NO persistence code
	// (conversationManager / appendConversationMessage / captureAndPersistStream) is included -
	// anonymous conversations are never stored.
	//
	// No dbConfig.tools gate here (unlike supahChat) - "tools" is never persisted on ChatConfig,
	// it's purely a per-message frontend choice in the authenticated flow. The public embed doesn't
	// offer that choice at all: any configured RAG datasource is always searched.
	const lastUserMsg = [...inputs].reverse().find((i): i is ChatInputMessage => i.type === "message.input" && i.role === "user")
	const queryText =
		lastUserMsg?.content
			.filter((c): c is InputText => c.type === "input_text")
			.map((c) => c.text)
			.join(" ")
			.trim() ?? ""

	// A/B flag (ChatConfig.scopeGuardEnabled, default off) - lets us compare guardrails-on vs
	// guardrails-off in practice before deciding this is how every embed bot should behave.
	if (queryText && dbConfig.scopeGuardEnabled) {
		// ON: scope-guard, combined with category classification in one utility-model call (see
		// classifyQuestion) - unlike supahChat's stats-only categorizeQuestion, this always runs
		// (even with no configured categories), because on this anonymous, public-facing route it's
		// also what keeps the bot from answering questions outside what it's meant for.
		//
		// History is passed so a bare follow-up ("Kan man ta med mat?" after "Når er eksamen?") is
		// judged in context instead of being misread as unrelated to the bot's purpose in isolation -
		// see classifyQuestion's own comment on why this matters more for inScope than for category.
		const categories = dbConfig.categories ?? []
		const history = formatHistoryForRewrite(inputs, lastUserMsg)
		const { category, suggestedTopic, inScope } = await classifyQuestion({ questionText: queryText, categories, scopeDescription: dbConfig.description, history })

		if (categories.length > 0) {
			// Fire-and-forget - must never block or fail the actual chat response.
			getStatsStore()
				.recordQuestionCategory(dbConfig._id, category, new Date(), suggestedTopic)
				.catch((error) => {
					logger.errorException(error, "Failed to record question category stat")
				})
		}

		if (!inScope) {
			return wantsStream ? responseStream(buildRefusalStream(OUT_OF_SCOPE_MESSAGE)) : json(buildRefusalResponse(dbConfig, OUT_OF_SCOPE_MESSAGE))
		}
	} else if (queryText && dbConfig.categories?.length) {
		// OFF (default): the exact same code path supahChat has always used - fire-and-forget,
		// stats-only, no scope check, nothing ever blocked. Keeping this a literal call to the same
		// shared function (not a lookalike) is the point of the A/B test: the "off" arm must be
		// genuinely identical to today's supahChat behavior, not just similar to it.
		recordQuestionCategoryStat(dbConfig._id, queryText, dbConfig.categories).catch((error) => {
			logger.errorException(error, "Failed to record question category stat")
		})
	}

	const ragStoreIds = dbConfig.dataSources?.filter((s) => s.type === "ragservice").map((s) => s.id) ?? []

	if (ragStoreIds.length > 0 && queryText) {
		// Anonymous caller: no graph token. getUserGroups falls back to [] when both the
		// principal's groups and the token are empty, so this still works, just with no groups.
		const matches = await searchRagStores(ragStoreIds, queryText, ANONYMOUS_PRINCIPAL, null)

		if (matches.length > 0) {
			dbConfig.instructions = appendRagContextToInstructions(dbConfig.instructions, matches)
		} else if (dbConfig.emptyRagGuardEnabled) {
			// A/B flag (ChatConfig.emptyRagGuardEnabled, default off), independent of
			// scopeGuardEnabled above - a bot with sources configured but zero relevant chunks found
			// would otherwise have the vendor answer from its own general knowledge, ungrounded.
			// Reuses OUT_OF_SCOPE_MESSAGE rather than a separate wording - from the visitor's side
			// both boil down to "I can't help with that here".
			return wantsStream ? responseStream(buildRefusalStream(OUT_OF_SCOPE_MESSAGE)) : json(buildRefusalResponse(dbConfig, OUT_OF_SCOPE_MESSAGE))
		}
	}

	// Strip internal Hugin tools that vendors don't know about
	dbConfig.tools = dbConfig.tools?.filter((t) => t.type !== "datasource")

	const vendor = getVendor(dbConfig.vendorId)
	const chatRequest = { config: dbConfig, inputs, stream: wantsStream }

	if (chatRequest.stream) {
		const stream = await vendor.createChatResponseStream(chatRequest)
		return responseStream(stream)
	}

	const response = await vendor.createChatResponse(chatRequest)
	return json(response)
}
