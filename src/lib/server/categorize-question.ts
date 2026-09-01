import { logger } from "@vestfoldfylke/loglady"
import { getStatsStore } from "$lib/server/db/get-db"
import { buildUtilityConfig, createUtilityChatResponse } from "$lib/server/utility-llm"
import { FALLBACK_CATEGORY } from "$lib/statsstore/types"
import type { ChatRequest, ChatResponseObject } from "$lib/types/chat"
import type { OutputText } from "$lib/types/chat-item-content"

export type CategorizationResult = {
	category: string
	// Only ever set when category === FALLBACK_CATEGORY (see UncategorizedSample) - a topic guess is
	// pointless once a real category was found, so it's dropped rather than carried along unused.
	suggestedTopic?: string
}

export type QuestionClassification = CategorizationResult & {
	// Whether the question is judged to be within the bot's intended purpose. Always true when the
	// caller didn't supply a scopeDescription (the check is opt-in - see classifyQuestion) and
	// always true on any failure/timeout, same fail-open philosophy as category falls back to
	// FALLBACK_CATEGORY rather than throwing: a flaky utility model must never be able to block a
	// real question.
	inScope: boolean
}

// The model is only ever asked to judge match/no-match (+ supply the matching detail) and,
// optionally, in-scope/out-of-scope - it never sees or produces our own FALLBACK_CATEGORY label.
// Mapping "no match" to that constant happens entirely in classifyQuestion below, in plain code,
// not baked into the prompt/model output - keeps the model's job minimal and this constant free to
// change without touching the prompt.
//
// The small utility model this runs on (see utility-llm.ts) needs an explicit worked example to
// reliably categorize by what the user is actually asking about rather than by surface keywords -
// same lesson learned for rag-query-rewrite.ts's pronoun resolution. Both sections below are asked
// for in ONE call rather than two separate utility-model round trips, and use explicit "LABEL:"
// prefixes (rather than positional lines) precisely because either section can be absent depending
// on the caller (categories may be empty, scopeDescription is optional) - a label lets the parser
// find each answer regardless of what else is present or what order the model puts them in.
//
// Instructions/labels are deliberately in English even though the content (category names, the
// bot's purpose, the user's question) is Norwegian - the default UTILITY_MODEL (Llama 3 8B, see
// utility-llm.ts) officially supports English/French/German/Hindi/Italian/Portuguese/Spanish/Thai,
// NOT Norwegian, so a small instruct model like this follows precise, conditional formatting rules
// far more reliably in English than in a language it was never specifically tuned for - even though
// it still reads the Norwegian content within that task just fine. Content stays Norwegian since
// that's the real domain data (Norwegian public-sector categories/questions) - only the scaffolding
// telling the model what to do with that data is translated.
const buildSystemPrompt = (categories: string[], scopeDescription: string | undefined, history: string | undefined): string => {
	const sections: string[] = []

	if (history) {
		// A follow-up question is often meaningless in isolation - "Kan man ta med mat?" ("Can I
		// bring food?") only reveals whether it's in scope once you know the prior turn was about an
		// exam, not e.g. a bus trip. Given as context only: the judgments below are always about the
		// CURRENT question (sent as the user message, not part of this history), never about
		// something asked earlier in the conversation.
		sections.push(`Recent conversation so far, for context only (oldest first):
${history}

Use this ONLY to understand what an ambiguous word or implicit reference in the CURRENT question (given separately below, as the actual message to classify) refers to. Do not classify or judge anything from this history itself - only the current question.`)
	}

	if (categories.length > 0) {
		sections.push(`Decide whether the user's question matches ONE of these categories:
${categories.map((category) => `- ${category}`).join("\n")}

Think about what the question is actually about - not just which words it uses.

Answer with one line starting with "CATEGORY: YES" followed by the category name - written exactly as in the list above - if the question matches one of the categories.
Answer with one line starting with "CATEGORY: NO" followed by a short (max 5-6 words) general description of what the question is about, if it does NOT match any category - like a heading, not an answer. Do not repeat names, place names, dates, times, or other specific/identifying details from the question.

Example: The categories are "Ruter og avganger", "Priser og billetter", "Mat og drikke" (Norwegian for "Routes and departures", "Prices and tickets", "Food and drink"). The question is "Kan jeg ta med meg en kebab på nattbussen?" ("Can I bring a kebab on the night bus?"). The question mentions the bus, but is actually about whether food is allowed on board - the correct category is "Mat og drikke", not "Ruter og avganger". Correct answer line:
CATEGORY: YES Mat og drikke`)
	}

	if (scopeDescription) {
		sections.push(`This chatbot exists for the following purpose: "${scopeDescription}"

Decide whether the user's question is relevant to and within this purpose - not just whether it superficially mentions the same topic, but whether it's something the bot should realistically answer.

Answer with one line starting with "SCOPE: YES" if the question is within the purpose.
Answer with one line starting with "SCOPE: NO" if the question is clearly unrelated to the purpose (e.g. asking for something completely different, like homework help, poems, code, translations, or other topics than what the bot is meant for).

Don't be overly strict - questions at the edge of the purpose (still about the same organization/service) should count as SCOPE: YES. Only clearly unrelated questions should get SCOPE: NO.

Example: The purpose is "Svare på spørsmål om busstilbudet til Vestfold og Telemark fylkeskommune" (Norwegian for "Answer questions about the bus services of Vestfold og Telemark county"). The question is "Skriv et dikt om katter" ("Write a poem about cats") - this is clearly unrelated. Correct answer line:
SCOPE: NO`)
	}

	sections.push(`Answer ONLY with the line(s) described above - no explanation, no quotation marks, no other text.`)

	return sections.join("\n\n")
}

// Strips wrapping quotes/punctuation and lowercases, so a near-miss in the model's formatting
// (trailing period, curly quotes, a stray "Kategori: " prefix) doesn't fail to match something
// that's otherwise clearly right.
const normalize = (s: string): string =>
	s
		.trim()
		.toLowerCase()
		.replace(/^["'«]+|["'».,!?:]+$/g, "")
		.trim()

// A weak model occasionally rambles beyond what it was asked for, or wraps an answer in extra
// prose on the same line - every non-empty line is a candidate, matched by label below rather than
// by position.
const responseLines = (response: ChatResponseObject): string[] => {
	const text = response.outputs
		.flatMap((output) => output.content)
		.filter((c): c is OutputText => c.type === "output_text")
		.map((c) => c.text)
		.join(" ")
		.trim()
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
}

// Finds the first line starting with `label` (e.g. "CATEGORY:") and splits its first word (YES/NO)
// from the rest (the category name / topic guess / nothing, depending on label). Returns undefined
// when the model never produced that labeled line at all - callers fail open on that (see
// classifyQuestion), same as any other unusable response.
const parseLabeledYesNo = (lines: string[], label: string): { isYes: boolean; detail: string } | undefined => {
	const line = lines.find((l) => l.toUpperCase().startsWith(label))
	if (!line) return undefined
	const [first, ...rest] = line.slice(label.length).trim().split(/\s+/)
	return { isYes: normalize(first ?? "").startsWith("yes"), detail: rest.join(" ").trim() }
}

// Classifies a single user question via the shared utility model ($lib/server/utility-llm) -
// decoupled from the chat's own vendor/model entirely, same pattern as rag-query-rewrite.ts. Two
// independent judgments, combined into one call so a caller that needs both never pays for two
// utility-model round trips:
//  - category: matches one of `categories` (ChatConfig.categories, author-defined, purely for
//    write-time anonymous usage statistics - see $lib/statsstore/types). Skipped entirely when
//    `categories` is empty.
//  - inScope: whether the question is within the bot's purpose, per `scopeDescription`. Skipped
//    entirely (always true) when `scopeDescription` is omitted - this is what a caller uses to
//    gate/refuse off-topic questions; a caller that only wants category stats (no gating) simply
//    doesn't pass it. NOT the same judgment as "matches a category" - a question can legitimately
//    be in scope without fitting any of the author's stats buckets (that's exactly what
//    FALLBACK_CATEGORY is for), so these two are asked and parsed independently rather than one
//    being derived from the other.
// `history` (see rag-query-rewrite.ts's formatHistoryForRewrite) is optional context for both
// judgments - matters most for inScope: a bare follow-up like "Kan man ta med mat?" is only
// classifiable once you know the prior turn was "Når er eksamen?". Omitted entirely by
// categorizeQuestion below (stats tolerate the occasional ambiguous-without-context miss just
// fine), but should be passed by any caller doing scope-gating - a false block from missing
// context is a real user turned away, not just noise in a stats bucket.
// No model call is made at all when there's nothing to ask about (no categories AND no
// scopeDescription, or empty question text) - same short-circuit the old categorizeQuestion had.
// Never throws - falls back to FALLBACK_CATEGORY / inScope: true on any failure (unreachable
// utility model, timeout, empty/garbage response), so a flaky utility model can neither skew stats
// nor block a real question.
export async function classifyQuestion(params: { questionText: string; categories: string[]; scopeDescription?: string | undefined; history?: string | undefined }): Promise<QuestionClassification> {
	const { questionText, categories, scopeDescription, history } = params

	if (!questionText.trim() || (categories.length === 0 && !scopeDescription)) {
		return { category: FALLBACK_CATEGORY, inScope: true }
	}

	try {
		const request: ChatRequest = {
			config: buildUtilityConfig(buildSystemPrompt(categories, scopeDescription, history)),
			inputs: [
				{
					type: "message.input",
					role: "user",
					content: [{ type: "input_text", text: questionText }]
				}
			],
			stream: false,
			store: false
		}

		const response = await createUtilityChatResponse(request)
		const lines = responseLines(response)

		let category = FALLBACK_CATEGORY
		let suggestedTopic: string | undefined
		if (categories.length > 0) {
			const parsed = parseLabeledYesNo(lines, "CATEGORY:")
			if (parsed?.isYes) {
				const detail = normalize(parsed.detail)
				const exactMatch = categories.find((c) => normalize(c) === detail)
				// Fall back to substring containment (e.g. the model wrapped the category in extra
				// words despite instructions, like "Category: Mat og drikke") - longest category name
				// first, so a more specific category ("Mat og drikke") wins over a shorter one that
				// happens to be a substring of it ("Mat"). Claimed a match but named something not
				// actually in the list -> stays FALLBACK_CATEGORY (never trust an invented category
				// name into the stats - that's exactly the cardinality problem we avoided).
				category = exactMatch ?? [...categories].sort((a, b) => b.length - a.length).find((c) => detail.includes(normalize(c))) ?? FALLBACK_CATEGORY
			} else if (parsed && !parsed.isYes) {
				suggestedTopic = parsed.detail || undefined
			}
		}

		// Fail open: only an explicit, parsed "SCOPE: NO" blocks. A missing/unparseable line (weak
		// model skipped it, malformed output, ...) must never turn into a false block.
		const scopeParsed = scopeDescription ? parseLabeledYesNo(lines, "SCOPE:") : undefined
		const inScope = scopeParsed ? scopeParsed.isYes : true

		return { category, ...(suggestedTopic && { suggestedTopic }), inScope }
	} catch (error) {
		logger.errorException(error, "Failed to classify question, falling back to Ukategorisert + in scope")
		return { category: FALLBACK_CATEGORY, inScope: true }
	}
}

// Thin wrapper over classifyQuestion for the stats-only use case (recordQuestionCategoryStat
// below) - no scopeDescription, so behavior/prompt shape here is byte-for-byte what this function
// always did, before classifyQuestion grew the scope-guard use case too.
export async function categorizeQuestion(questionText: string, categories: string[]): Promise<CategorizationResult> {
	const { category, suggestedTopic } = await classifyQuestion({ questionText, categories })
	return { category, ...(suggestedTopic && { suggestedTopic }) }
}

// Classifies one question and writes the (agentId, category, date[, suggestedTopic]) event to the
// stats store ($lib/statsstore/types) - stats-only, no scope-guard, never blocks. Shared by both
// chat routes that record question-category stats (supahChat always; the public embed route only
// when its scopeGuardEnabled A/B flag is off - see embed/api/chat/+server.ts) so the "guardrails
// off" arm of that A/B test is genuinely identical code to supahChat's behavior, not just similar.
// Caller is responsible for not awaiting this blocking-ly (fire-and-forget with a .catch), since
// none of this should ever slow down or fail the actual chat response.
export async function recordQuestionCategoryStat(agentId: string, questionText: string, categories: string[]): Promise<void> {
	const { category, suggestedTopic } = await categorizeQuestion(questionText, categories)
	await getStatsStore().recordQuestionCategory(agentId, category, new Date(), suggestedTopic)
}
